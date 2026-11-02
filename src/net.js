// The connection to the game server (Climb-and-slide-for-eggs-backend, a Colyseus room). It does
// four things: loads the signed-in player's save before the game starts, sends the sections that
// changed (saves.js), runs the Daily Rewards calendar (the server owns its clock) and checks a
// finished rewarded ad before the reward is paid. Without a server (SDK blocked, nothing running
// locally, a guest with no token) everything stays in localStorage and this module is inert.
import { Client } from '@colyseus/sdk'
import * as bloxity from './bloxity.js'
import { NET } from './config.js'
import * as saves from './saves.js'

const state = {
  room: null,
  synced: false, // the server's answer to this session's load was taken in at boot: saving is on
  booted: false,
  dailyView: null, // { unlocked, claimed[], nextAt, serverTime }
}
const dirty = new Set()
const dailyListeners = new Set()
const pending = new Map() // 'dailyResult:<day>' / 'adResult' -> resolve
let flushTimer = null
let firstAnswer = null // resolves the boot gate

const local = () => /^(localhost|127\.0\.0\.1)$/.test(location.hostname)

// Where to connect: Boxity's matchmaker, or the local server in `npm run dev`. Null = no server.
async function endpoint(userId) {
  if (bloxity.canResolveServer()) return (await bloxity.resolveServerEndpoint(userId)).endpoint
  if (import.meta.env.DEV || local()) return NET.devServer
  return null
}

function joinOptions() {
  const u = bloxity.authState.user ?? bloxity.authState.guest
  return {
    token: bloxity.getToken(),
    userId: u?._id ?? (bloxity.sdkAvailable() ? '' : 'dev-player'), // trusted only by a local server
    username: bloxity.displayName(),
    pfp: bloxity.getPfp(),
  }
}

// The player the saves belong to ('dev' without the SDK).
export const identity = () => (bloxity.authState.user ?? bloxity.authState.guest)?._id ?? (bloxity.sdkAvailable() ? 'guest' : 'dev')

async function connect() {
  const userId = identity()
  const url = await endpoint(userId)
  if (!url) throw new Error('no server')
  const launch = bloxity.launchRoomId()
  const found = launch ? await bloxity.locateRoom(launch).catch(() => null) : null
  const client = new Client(found?.endpoint ?? url)
  const room = found ? await client.joinById(found.roomId, joinOptions()).catch(() => client.joinOrCreate(NET.room, joinOptions())) : await client.joinOrCreate(NET.room, joinOptions())

  room.onMessage('progress', (doc) => got(true, doc))
  room.onMessage('noProgress', () => got(false))
  room.onMessage('serverError', () => got(null))
  room.onMessage('daily', (view) => setDaily(view))
  room.onMessage('dailyResult', (msg) => {
    if (msg.unlocked !== undefined) setDaily(msg)
    pending.get(`dailyResult:${msg.day}`)?.(!!msg.ok)
  })
  room.onMessage('adResult', (msg) => pending.get('adResult')?.(!!msg.ok))
  room.onLeave((code) => {
    if (state.room === room) state.room = null
    if (code !== 1000 && state.synced) reconnect() // 1000 = we left on purpose
  })
  state.room = room
  // Friends' invites and the Open Rooms list join through this id (the relay pins the pod).
  bloxity.updateRoom(room.roomId)
}

// The server answered the load: with the saved document, nothing (a new account / a guest) or an
// error (the save could not be read: saving stays off so it is never overwritten).
function got(hasDoc, doc) {
  if (hasDoc === null) return firstAnswer?.('error')
  if (!state.booted) {
    if (hasDoc) saves.hydrate(doc)
    else for (const key of saves.sectionKeys()) dirty.add(key) // a new account keeps what it played as a guest
    state.synced = true
    firstAnswer?.(hasDoc ? 'progress' : 'new')
  } else if (state.synced) {
    // A reconnect: the game state in memory is the newest, send it again.
    for (const key of saves.sectionKeys()) dirty.add(key)
    state.synced = true
  }
  flushSoon()
}

function setDaily(view) {
  state.dailyView = { ...view, offset: Date.now() - view.serverTime }
  for (const fn of dailyListeners) fn(state.dailyView)
}

let retry = 0
function reconnect() {
  const wait = Math.min(15000, 1000 * 2 ** retry++)
  setTimeout(() => connect().then(() => (retry = 0)).catch(() => reconnect()), wait)
}

// Boot gate: resolves once the server has answered (or given up). main.js awaits it before the
// systems load their saves, so they start from the server's copy. A cold server can take ~45 s;
// waiting longer than NET.bootWait plays this session on the local copy.
export async function start() {
  if (!bloxity.sdkAvailable() && !import.meta.env.DEV && !local()) return 'offline'
  const wait = bloxity.sdkAvailable() ? NET.bootWait : NET.devBootWait
  const answer = new Promise((resolve) => (firstAnswer = resolve))
  const attempt = async () => {
    for (let i = 0; !state.booted; i++) {
      try {
        await connect()
        return
      } catch (err) {
        if (err?.message === 'no server') return
        await new Promise((r) => setTimeout(r, Math.min(4000, 500 * 2 ** i)))
      }
    }
  }
  attempt()
  const result = await Promise.race([answer, new Promise((r) => setTimeout(() => r('offline'), wait))])
  state.booted = true
  if (result === 'offline' || result === 'error') {
    // Not synced: this session stays on the local copy and never writes over the server's save.
    try {
      state.room?.leave()
    } catch {
      // Already closed.
    }
  }
  return result
}

// --- Saving ------------------------------------------------------------------------------------
saves.onStore((key) => {
  dirty.add(key)
  flushSoon()
})

function flushSoon() {
  if (flushTimer || !dirty.size) return
  flushTimer = setTimeout(flush, NET.saveDelay)
}

export function flush() {
  clearTimeout(flushTimer)
  flushTimer = null
  if (!state.room || !state.synced || !dirty.size) return
  const keys = [...dirty]
  dirty.clear()
  try {
    state.room.send('saveProgress', { ...saves.snapshot(keys), lastSeen: Date.now() })
  } catch {
    for (const key of keys) dirty.add(key) // the socket was closing: try again after the reconnect
  }
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
window.addEventListener('pagehide', flush)

// --- Daily Rewards -------------------------------------------------------------------------------
export const daily = () => state.dailyView
export function onDaily(fn) {
  dailyListeners.add(fn)
  return () => dailyListeners.delete(fn)
}
// The countdown reached the next UTC day: the server unlocks it and sends the new calendar.
export const refreshDaily = () => state.room?.send('dailyRefresh')

function ask(key, send) {
  return new Promise((resolve) => {
    const done = (ok) => {
      clearTimeout(timer)
      pending.delete(key)
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), 8000)
    pending.set(key, done)
    send()
  })
}

// True once the server stored the claim; only then is the reward paid.
export function claimDaily(day) {
  if (!state.room) return Promise.resolve(false)
  return ask(`dailyResult:${day}`, () => state.room.send('claimDaily', { day }))
}

// --- Rewarded ads -----------------------------------------------------------------------------------
// True when Bloxity confirms the finished ad (single-use token, this game, this placement).
export function verifyAd(placement, rewardToken) {
  if (!state.room) return Promise.resolve(false)
  return ask('adResult', () => state.room.send('adReward', { placement, rewardToken }))
}

export const connected = () => !!state.room
