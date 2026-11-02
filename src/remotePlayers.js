// Other players in the room (presence). The server relays each player's pose + Bloxity avatar
// look (net.roster()); here they are drawn with the same avatar loader and animator as the local
// player, interpolated between updates, with a name tag and Bloxity chat bubbles. Only the
// nearest `preset.remotes` players are drawn at once (graphics preset, lower on phones).
import * as THREE from 'three'
import { CanvasTexture, Group, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { PLAYER_DIMS, REMOTE, TRAIN } from './config.js'
import * as bloxity from './bloxity.js'
import * as net from './net.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'

const MAX_SNAPSHOTS = 8
const lerp = (a, b, t) => a + (b - a) * t
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))

function nameTexture(name) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const g = canvas.getContext('2d')
  g.font = '600 34px Fredoka, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = 7
  g.strokeStyle = 'rgba(20, 20, 30, 0.85)'
  g.fillStyle = '#fff'
  const text = name.length > 16 ? `${name.slice(0, 15)}…` : name
  g.strokeText(text, 128, 34)
  g.fillText(text, 128, 34)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export function createRemotePlayers({ scene, camera, localGroup, localPosition, maxDrawn }) {
  const entries = new Map() // sessionId -> entry, only for players currently drawn
  let sinceSelect = REMOTE.reselectEvery
  const now = () => performance.now() / 1000

  function setCharacter(e, root) {
    if (e.avatar) e.body.remove(e.avatar)
    disposeAnimator(e.animator)
    e.avatar = root
    e.body.add(root)
    e.animator = makeAnimator(root)
  }

  // Dresses the entry with the look the player sent (JSON text, parsed here, defensively).
  async function loadLook(e, look) {
    const mine = ++e.generation
    let parsed = null
    try {
      parsed = look ? JSON.parse(look) : null
    } catch {
      parsed = null
    }
    const equipped = parsed && typeof parsed.e === 'object' ? parsed.e : null
    try {
      const group = await loadBaseCharacter()
      if (mine !== e.generation || e.dead) return
      if (equipped) await attachEquippedAccessories(group, equipped)
      if (mine !== e.generation || e.dead) return
      applyProportions(group, parsed && typeof parsed.p === 'object' ? parsed.p : null)
      setCharacter(e, group)
    } catch (err) {
      console.warn('[remote] avatar failed', err)
    }
  }

  function makeEntry(id) {
    const root = new Group()
    root.rotation.order = 'YXZ'
    const body = new Group()
    root.add(body)
    const label = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, fog: false }))
    label.center.set(0.5, 0)
    label.scale.set(2.2, 0.55, 1)
    label.position.y = PLAYER_DIMS.height + REMOTE.labelHeight
    root.add(label)
    root.visible = false
    scene.add(root)
    const e = { id, root, body, label, avatar: null, animator: null, snaps: [], look: null, name: null, generation: 0, bubble: null, vy: 0, dead: false }
    setCharacter(e, buildDefaultCharacter())
    return e
  }

  function dispose(e) {
    e.dead = true
    e.bubble?.remove?.()
    disposeAnimator(e.animator)
    scene.remove(e.root)
    e.label.material.map?.dispose()
    e.label.material.dispose()
    e.avatar?.traverse((o) => {
      if (!o.isMesh || !o.material) return
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose?.() // per-instance copies (loader.js ownMaterials)
    })
  }

  // The nearest players with a pose, up to the preset's cap.
  function select(list) {
    const px = localPosition.x
    const pz = localPosition.z
    const near = list.filter(([, p]) => p.posed).map(([id, p]) => [(p.x - px) ** 2 + (p.z - pz) ** 2, id])
    near.sort((a, b) => a[0] - b[0])
    return new Set(near.slice(0, maxDrawn).map((n) => n[1]))
  }

  function record(e, p, t) {
    const last = e.snaps[e.snaps.length - 1]
    if (last && last.x === p.x && last.y === p.y && last.z === p.z && last.yaw === p.yaw) return
    e.snaps.push({ t, x: p.x, y: p.y, z: p.z, yaw: p.yaw })
    if (e.snaps.length > MAX_SNAPSHOTS) e.snaps.shift()
  }

  // Position at render time `rt` between the two surrounding updates; speed from that segment.
  function sample(e, rt) {
    const s = e.snaps
    const last = s[s.length - 1]
    if (s.length === 1 || rt >= last.t) return { ...last, moving: 0, vy: 0 }
    if (rt <= s[0].t) return { ...s[0], moving: 0, vy: 0 }
    let i = s.length - 2
    while (i > 0 && s[i].t > rt) i--
    const a = s[i]
    const b = s[i + 1]
    const span = b.t - a.t || 1
    const k = (rt - a.t) / span
    const jump = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    if (jump > REMOTE.snapDistance) return { ...b, moving: 0, vy: 0 }
    return {
      x: lerp(a.x, b.x, k),
      y: lerp(a.y, b.y, k),
      z: lerp(a.z, b.z, k),
      yaw: a.yaw + wrapAngle(b.yaw - a.yaw) * k,
      moving: Math.hypot(b.x - a.x, b.z - a.z) / span,
      vy: (b.y - a.y) / span,
    }
  }

  function update(dt) {
    const roster = net.roster()
    if (!roster) {
      for (const e of entries.values()) dispose(e)
      entries.clear()
      return
    }
    const list = []
    roster.players.forEach((p, id) => id !== roster.self && list.push([id, p]))

    sinceSelect += dt
    if (sinceSelect >= REMOTE.reselectEvery) {
      sinceSelect = 0
      const chosen = select(list)
      for (const [id, e] of entries) {
        if (chosen.has(id)) continue
        dispose(e)
        entries.delete(id)
      }
      for (const id of chosen) if (!entries.has(id)) entries.set(id, makeEntry(id))
    }

    const t = now()
    const rt = t - REMOTE.interpDelay
    for (const [id, p] of list) {
      const e = entries.get(id)
      if (!e) continue
      record(e, p, t)
      if (p.avatar !== e.look) {
        e.look = p.avatar
        loadLook(e, p.avatar)
      }
      if (p.username !== e.name) {
        e.name = p.username
        e.label.material.map?.dispose()
        e.label.material.map = nameTexture(p.username || 'Player')
        e.label.material.needsUpdate = true
      }
    }
    for (const [id, e] of entries) {
      if (!e.snaps.length || !roster.players.has(id)) {
        e.root.visible = false
        continue
      }
      const s = sample(e, rt)
      const state = roster.players.get(id)
      const flags = state.anim || 0
      e.root.visible = true
      e.root.position.set(s.x, s.y, s.z)
      e.root.rotation.y = s.yaw
      const dx = s.x - localPosition.x
      const dz = s.z - localPosition.z
      const dist = Math.hypot(dx, dz)
      e.label.visible = dist < REMOTE.labelRange
      e.animator?.update(dt, {
        grounded: Math.abs(s.vy) < 1.5,
        speed: s.moving > 0.2 ? state.speed || s.moving : 0,
        verticalVelocity: s.vy,
        turn: 0,
        slide: !!(flags & 1),
        carry: flags & 2 ? 'overhead' : flags & 4 ? 'hold' : null,
        lift: flags & 8 ? (1 - Math.cos(t * TRAIN.reps * Math.PI)) / 2 : null,
      })
    }
  }

  // A chat message: a 4 s bubble over the sender (the local player, or the drawn remote with that
  // Bloxity id / name). Senders that are not on screen get none.
  bloxity.onChat((m) => {
    let target = null
    if (m.isLocalPlayer) target = { root: localGroup, set: (b) => (localBubble = b), old: () => localBubble }
    else {
      const roster = net.roster()
      if (!roster) return
      for (const [id, e] of entries) {
        const p = roster.players.get(id)
        if (p && (p.uid ? p.uid === m.userId : p.username === m.username)) target = { root: e.root, set: (b) => (e.bubble = b), old: () => e.bubble }
      }
    }
    if (!target) return
    target.old()?.remove?.()
    target.set(bloxity.attachBubble(THREE, target.root, m.text, REMOTE.bubbleHeight))
  })
  let localBubble = null

  return { update, count: () => entries.size }
}
