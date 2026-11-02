import { AdditiveBlending, CanvasTexture, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Sprite, SpriteMaterial, SRGBColorSpace, Vector3 } from 'three'
import { AUDIO, CLIMB, climbY, INDEX, LOBBY, RUN, ZONES, zoneAt } from './config.js'
import { sfx } from './audio/index.js'
import { aimCamera } from './camera.js'
import { lockStone } from './climb.js'
import { createClimbHud } from './climbHud.js'
import { inputState, onKey } from './input.js'
import { revealEgg } from './petIndex.js'
import { player, resetPlayer } from './player.js'
import { label, std } from './propkit.js'
import { paintSoftDot } from './textures.js'
import { speckle, voxelGeometry } from './voxel.js'
import * as bloxity from './bloxity.js'
import * as saves from './saves.js'

// A climb run. Stepping on the stairs takes the player over (player.drive): they carry the
// mystery egg up on their own, tapping climbs faster, and every metre spends a point of
// strength. When the bar is empty they jump onto the slide, ride it to the arena floor, land,
// and the egg hatches into one of the tier they reached, with their luck for a better one.
const { north: N } = LOBBY
const { length: L, slope, stairs, water } = CLIMB
const pitch = Math.atan(slope)
const slopeLen = Math.hypot(1, slope)
const stairX = (stairs[0] + stairs[1]) / 2
const waterX = (water[0] + water[1]) / 2
const zAt = (s) => N - s
const luckAt = (m) => 1 + RUN.luck[0] * m + RUN.luck[1] * m * m
const OVERHEAD = 2.05 // m above the feet the carried egg sits

const paceAt = (m) => Math.min(RUN.paceMax, Math.max(1, m / RUN.paceFrom))

// HUD metres a run reaches with this strength (RUN.reach).
function reachOf(points) {
  const [[s0, m0]] = RUN.reach
  if (points <= s0) return Math.round((points * m0) / s0)
  for (let i = 1; i < RUN.reach.length; i++) {
    const [a, from] = RUN.reach[i - 1]
    const [b, to] = RUN.reach[i]
    if (points < b) return Math.round(from + ((to - from) * Math.log(points / a)) / Math.log(b / a))
  }
  return RUN.reach.at(-1)[1]
}

const tierAt = (m) => RUN.tiers.reduce((at, tier, i) => (m >= tier.m ? i : at), -1)
const eggName = (id) => INDEX.eggs.find((e) => e.id === id)?.name ?? id

// The voxel shell of a tier's egg (held in the hand, placed on the plot).
const shells = new Map()
export function eggShell(i) {
  if (!shells.has(i)) {
    const unit = 0.075
    shells.set(i, voxelGeometry([['e', 0, 0.6, 0, 0.5, 0.62, 0.5, speckle(unit, RUN.tiers[i].shell, 7 + i)]], unit))
  }
  return shells.get(i)
}

// The save (saves.js, which sends it to the backend). eggs = tier index per egg in the hotbar.
function load() {
  const save = { best: import.meta.env.DEV ? RUN.devBest : 0, strength: RUN.strength, eggs: [], auto: false }
  try {
    Object.assign(save, saves.load(RUN.saveKey))
  } catch {
    // No storage, or a bad save: start from the default.
  }
  return save
}
function store(save) {
  try {
    saves.store(RUN.saveKey, save)
  } catch {
    // Storage blocked: the progress lasts this session.
  }
}

export function createClimbRun({ scene, group, camera, world }) {
  const save = load()
  const { bursts, climb } = world
  const hud = createClimbHud({ onAuto: toggleAuto, onSlot: selectSlot })
  hud.setStrength(save.strength)
  hud.setAuto(save.auto)
  hud.setBestMark(save.best)
  const showBest = (metres) => climb.setBest(metres, bloxity.displayName())
  showBest(save.best)

  // --- The eggs ------------------------------------------------------------------------
  const mystery = new Mesh(lockStone(0.5), std('#ffffff', { vertexColors: true, roughness: 0.7, emissive: '#ffffff', emissiveIntensity: 0 }))
  mystery.castShadow = true
  mystery.position.y = OVERHEAD
  mystery.visible = false
  group.add(mystery)

  const held = new Group()
  held.position.set(0.75, 0.25, 1.15)
  group.add(held)
  const heldMat = std('#ffffff', { vertexColors: true, roughness: 0.7 })
  const heldMesh = new Mesh(undefined, heldMat)
  heldMesh.castShadow = true
  heldMesh.scale.setScalar(1.15)
  held.add(heldMesh)
  held.visible = false
  // Eggs of a tier share a hotbar slot.
  const stacks = () => {
    const out = []
    for (const tierIdx of save.eggs) {
      const stack = out.find((s) => s.tierIdx === tierIdx)
      if (stack) stack.count++
      else out.push({ tierIdx, tier: RUN.tiers[tierIdx], name: eggName(RUN.tiers[tierIdx].egg), count: 1 })
    }
    return out
  }
  let plate = null
  let slot = stacks().length // 0 is the dumbbell, n is stacks()[n - 1]

  // Shows the egg in the selected slot in the player's hand, with its name over it.
  function showHeld() {
    const list = stacks()
    const tierIdx = list[slot - 1]?.tierIdx
    held.visible = tierIdx !== undefined && state === 'idle' && !training
    hud.setHotbar(list, slot)
    if (plate) {
      held.remove(plate)
      plate.material.map.dispose()
      plate.material.dispose()
      plate = null
    }
    if (!held.visible) return
    const tier = RUN.tiers[tierIdx]
    heldMesh.geometry = eggShell(tierIdx)
    plate = label([[[eggName(tier.egg), '#ffffff']], [[tier.name, tier.color]]], 0.62, { bg: null, outline: '#000000', outlineWidth: 7, font: '800 56px Fredoka, "Arial Black", sans-serif', pad: 8 })
    plate.position.set(0, 2.1, 0)
    held.add(plate)
  }

  function selectSlot(i) {
    if (i > stacks().length || state !== 'idle' || training) return
    slot = i
    sfx.holster()
    showHeld()
  }
  for (let i = 0; i < RUN.hotbar; i++) onKey(`Digit${i + 1}`, () => selectSlot(i))

  function toggleAuto() {
    save.auto = !save.auto
    hud.setAuto(save.auto)
    sfx.toggle(save.auto)
    store(save)
  }

  // --- The hatch orb -------------------------------------------------------------------
  const orbTex = new CanvasTexture(paintSoftDot(128))
  orbTex.colorSpace = SRGBColorSpace
  const orb = new Sprite(new SpriteMaterial({ map: orbTex, color: '#39e8ff', blending: AdditiveBlending, transparent: true, depthWrite: false }))
  const ORB_AT = new Vector3(0.9, 1, 1.1)
  orb.position.copy(ORB_AT)
  orb.visible = false
  group.add(orb)
  const orbWorld = new Vector3()

  // --- The coins on the stairs: a few instances, always the next ones up -----------------
  const coinS = RUN.coinStep / RUN.metresPerS
  const coins = new InstancedMesh(new CylinderGeometry(0.42, 0.42, 0.12, 14), std('#ffd23a', { metalness: 0.4, roughness: 0.35, emissive: '#c88a10', emissiveIntensity: 0.5 }), RUN.coinsShown)
  coins.frustumCulled = false
  coins.visible = false
  scene.add(coins)
  const coinMatrix = new Matrix4()
  const coinTurn = new Quaternion()
  const coinAxis = new Vector3(0, 1, 0)
  const coinUp = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
  const coinPos = new Vector3()
  const coinScale = new Vector3(1, 1, 1)
  let nextCoin = 1 // index of the next coin, the first at coinS
  let coinCash = 0 // paid this run
  let coinCount = 0 // and how many
  let coinPay = () => 0 // pays one, returns how much; set from main.js
  let spin = 0

  function drawCoins(dt) {
    spin += dt * 4
    coinTurn.setFromAxisAngle(coinAxis, spin).multiply(coinUp)
    for (let i = 0; i < RUN.coinsShown; i++) {
      const at = (nextCoin + i) * coinS
      coinPos.set(stairX, climbY(zAt(at)) + 1.3, zAt(at))
      if (at >= L - 1) coinScale.setScalar(0)
      else coinScale.setScalar(1)
      coins.setMatrixAt(i, coinMatrix.compose(coinPos, coinTurn, coinScale))
    }
    coins.instanceMatrix.needsUpdate = true
  }

  // --- State ---------------------------------------------------------------------------
  let state = 'idle' // idle, climb, hop, slide, fly
  let s = 0 // metres north of the wall
  let m = 0 // HUD metres
  let peak = 0 // the metres this run reached
  let strength = 0
  let strengthMulti = () => 1 // the equipped trail's, set from main.js
  const gained = (n) => Math.max(1, Math.round(n * strengthMulti()))
  let maxStrength = 1
  let pace = 1 // times the run's speeds
  let boost = 0 // m/s from tapping
  let autoWait = 0
  let passed = -1 // highest checkpoint passed
  let milestone = 0
  let bestAtStart = 0
  let boardAt = 0 // metres the YOUR BEST board shows
  let nextPad = 1
  let zone = null
  let recordShown = false
  let hopT = 0
  let hopFrom = 0
  let slideSpeed = 0
  let spray = 0
  let flyZ = 0
  let flyY = 0
  let eggGlow = 0
  let eggPop = 0
  let reveal = null // { t, luck, orbOn, hush }
  let fullBoost = false // the top of the boost has had its sound
  let lowHinted = false // so has the bar running low
  let slideMark = 0 // the last height mark passed on the way down
  const sound = { climbing: false, zone: 0, slide: 0, air: 0, metres: 0, tension: 0 } // run.sound()
  let training = false // lifting on the pad (training.js): the hands are taken
  showHeld()

  // A press on the world is a tap (on touch the zones are the world).
  window.addEventListener('pointerdown', (e) => {
    if (e.target instanceof HTMLCanvasElement || e.target.closest?.('.touch-zone')) tap()
  }, { capture: true })

  function checkpointBanner() {
    const next = RUN.tiers[passed + 1]
    hud.setBanner(next && next.m / RUN.metresPerS < L ? { number: passed + 2, tier: next, left: next.m - m } : null)
  }

  function start(fromS) {
    finishReveal()
    state = 'climb'
    s = fromS
    m = peak = s * RUN.metresPerS
    maxStrength = strength = reachOf(save.strength)
    pace = paceAt(maxStrength)
    boost = 0
    passed = tierAt(m)
    milestone = Math.floor(m / RUN.milestone)
    bestAtStart = save.best
    boardAt = save.best
    nextCoin = Math.floor(s / coinS) + 1
    coinCash = coinCount = 0
    coins.visible = true
    nextPad = Math.floor(m / RUN.padStep) + 1
    zone = zoneAt(m)
    sfx.setSong(ZONES.indexOf(zone))
    fullBoost = lowHinted = false
    recordShown = false
    eggGlow = 1
    eggPop = 1
    mystery.position.set(0, OVERHEAD, 0)
    mystery.scale.setScalar(1)
    mystery.rotation.set(0, 0, 0)
    mystery.visible = true
    player.drive = tick
    player.grounded = true
    player.facing = Math.PI
    player.tilt = 0
    showHeld()
    aimCamera(0, 0.3)
    hud.enterRun()
    hud.setBar(strength, maxStrength, save.strength)
    hud.setLuck(1)
    hud.setMeter(m)
    hud.tag(RUN.tiers[Math.max(passed, 0)])
    checkpointBanner()
    sfx.runStart()
    bursts.emit({ count: 24, pos: [player.position.x, player.position.y + OVERHEAD + 0.5, player.position.z], spread: [0.5, 0.5, 0.5], radial: 3, life: 0.7, size: 0.32, color: '#ffffff' })
  }

  function tap(auto = false) {
    if (state !== 'climb') return
    boost = Math.min(RUN.maxBoost, boost + RUN.tapBoost)
    hud.tapped()
    sfx.tap(boost / RUN.maxBoost, auto)
    if (boost >= RUN.maxBoost && !fullBoost) sfx.fullPower()
    fullBoost = boost >= RUN.maxBoost * 0.6 && (fullBoost || boost >= RUN.maxBoost)
    const p = player.position
    bursts.emit({ layer: 'chunk', count: 5, pos: [p.x, p.y + 0.15, p.z], spread: [0.4, 0.05, 0.2], vel: [0, 2.4, 1.2], jitter: [1.2, 1, 0.8], gravity: -14, life: 0.5, size: 0.14, color: '#d9e4e6', color2: '#ffffff' })
  }

  function hop() {
    state = 'hop'
    coins.visible = false
    pace = paceAt(peak)
    hopT = 0
    hopFrom = player.position.x
    player.velocity.x = player.velocity.z = 0
    sfx.hop()
    hud.setBanner(null)
    hud.slideMode()
    aimCamera(Math.PI, 0.42, 1.4)
  }

  function land() {
    const p = player.position
    state = 'idle'
    p.y = 0.05
    player.drive = null
    player.grounded = true
    player.tilt = 0
    player.velocity.x = player.velocity.y = player.velocity.z = 0
    const newBest = peak > save.best
    const near = !newBest && save.best > 0 && peak >= save.best * AUDIO.nearMiss
    if (newBest) save.best = peak
    const gain = gained(RUN.strengthPerRun)
    save.strength += gain
    hud.setStrength(save.strength)
    hud.result({ metres: Math.floor(peak), newBest, gain, cash: coinCash })
    sfx.touchdown(Math.min(1, flyZ / RUN.launchSpeed))
    sfx.result({ newBest, near, coins: coinCount })
    showBest(save.best)
    hud.setBestMark(save.best)
    store(save)
    if (newBest) bloxity.submitScore('best-climb', peak)
    bloxity.submitScore('strength', save.strength)
    bursts.emit({ layer: 'chunk', count: 46, pos: [p.x, 0.5, p.z], spread: [0.9, 0.4, 0.9], radial: 4, vel: [0, 4.5, 0], jitter: [2, 2.5, 2], gravity: -18, life: 0.75, size: 0.34, color: '#fff7dc', color2: '#ffffff' })
    bursts.emit({ layer: 'glow', count: 14, pos: [p.x, 0.8, p.z], spread: [1, 0.5, 1], radial: 2, life: 0.6, size: 1.6, color: '#fff2a8' })
    reveal = { t: 0, luck: luckAt(peak), orbOn: false }
  }

  function finishReveal() {
    if (!reveal) return
    const { luck, hush } = reveal
    hush?.()
    reveal = null
    orb.visible = false
    mystery.visible = false
    hud.chip(null)
    let tierIdx = Math.max(tierAt(peak), 0)
    const lucky = tierIdx + 1 < RUN.tiers.length && Math.random() < RUN.upgradeChance * luck
    if (lucky) tierIdx++
    const tier = RUN.tiers[tierIdx]
    sfx.reveal(tierIdx, lucky)
    save.eggs.push(tierIdx)
    slot = stacks().findIndex((s) => s.tierIdx === tierIdx) + 1
    store(save)
    revealEgg(tier.egg)
    hud.flash(tier.color)
    showHeld()
  }

  // One physics tick of a run. velocity is only what the animator and speed FOV read, in HUD
  // m/s on the stairs: the world climbs slower than the numbers, the legs should not.
  function tick(dt) {
    const p = player.position
    if (inputState.jump) {
      inputState.jump = false
      tap()
    }
    if (state === 'climb') {
      if (save.auto) {
        autoWait -= dt
        if (autoWait <= 0) {
          autoWait = 1 / RUN.autoRate
          tap(true)
        }
      }
      boost = Math.max(0, boost - RUN.boostDecay * dt)
      const speed = RUN.speed + boost
      const step = Math.min(speed * pace * dt, strength)
      m += step
      peak = m
      strength -= step
      s = m / RUN.metresPerS
      p.x += (stairX - p.x) * Math.min(1, 8 * dt)
      p.z = zAt(s)
      p.y = climbY(p.z)
      player.velocity.z = -speed
      hud.setBar(strength, maxStrength, save.strength)
      hud.setLuck(luckAt(m))
      hud.setMeter(m)
      if (!lowHinted && strength / maxStrength < RUN.lowStrength) {
        lowHinted = true
        sfx.lowStrength()
      }
      const tier = tierAt(m)
      if (tier > passed) {
        passed = tier
        hud.tag(RUN.tiers[tier])
        sfx.tier(tier)
        eggGlow = eggPop = 1
        bursts.emit({ count: 36, pos: [p.x, p.y + 2.2, p.z], spread: [1.6, 1.6, 0.6], radial: 2.4, life: 0.9, size: 0.34, color: RUN.tiers[tier].color, color2: '#ffffff' })
      }
      checkpointBanner()
      const here = zoneAt(m)
      if (here !== zone) {
        zone = here
        sfx.setSong(ZONES.indexOf(zone))
        sfx.zone()
        hud.headline(zone.name.toUpperCase())
      }
      while (nextCoin * coinS <= s) {
        nextCoin++
        coinCash += coinPay()
        sfx.coin(coinCount++)
        bursts.emit({ count: 8, pos: [p.x, p.y + 1.3, p.z], spread: [0.3, 0.3, 0.3], radial: 3, life: 0.45, size: 0.22, color: '#ffd23a', color2: '#ffffff' })
      }
      if (nextPad * RUN.padStep <= m) {
        nextPad++
        boost = RUN.maxBoost
        hud.tag({ name: 'Speed Boost', color: '#fff27a' })
        sfx.speedPad()
        bursts.emit({ count: 22, pos: [p.x, p.y + 0.4, p.z], spread: [1.2, 0.2, 0.6], vel: [0, 2, -3], jitter: [1, 1, 1], life: 0.6, size: 0.26, color: '#fff27a', color2: '#ffffff' })
      }
      if (m > bestAtStart && m >= boardAt + RUN.bestStep) {
        boardAt = m
        showBest(m)
        hud.setBestMark(m)
      }
      if (Math.floor(m / RUN.milestone) > milestone) {
        milestone = Math.floor(m / RUN.milestone)
        hud.milestone(milestone * RUN.milestone)
        sfx.milestone(milestone)
      }
      if (!recordShown && bestAtStart > 0 && m > bestAtStart) {
        recordShown = true
        hud.headline('NEW RECORD!')
        sfx.record()
        bursts.emit({ count: 40, pos: [p.x, p.y + 2.4, p.z], spread: [1.2, 1.2, 0.6], radial: 3, life: 1, size: 0.3, color: '#ffd23a', color2: '#ffffff' })
      }
      if (strength <= 0 || s >= L - 1) hop()
    } else if (state === 'hop') {
      hopT += dt / RUN.hop
      const t = Math.min(hopT, 1)
      p.x = hopFrom + (waterX - hopFrom) * t
      p.y = climbY(p.z) + RUN.waterLift * t + Math.sin(t * Math.PI) * RUN.hopHeight
      player.facing = Math.PI * (1 - t)
      player.tilt = pitch * t
      player.grounded = false
      player.velocity.y = Math.cos(t * Math.PI) * 6
      if (t >= 1) {
        state = 'slide'
        slideSpeed = 2
        spray = 0
        slideMark = Math.floor(m / RUN.milestone)
        player.grounded = true
        sfx.splash(0.9)
        bursts.emit({ layer: 'chunk', count: 26, pos: [p.x, p.y + 0.15, p.z], spread: [1, 0.05, 0.5], vel: [0, 3.5, 1], jitter: [2, 1.6, 1.5], gravity: -16, life: 0.6, size: 0.17, color: '#ffffff', color2: '#7feeff' })
      }
    } else if (state === 'slide') {
      slideSpeed = Math.min(RUN.slideMax * pace, slideSpeed + RUN.slideAccel * pace * dt)
      s -= (slideSpeed / slopeLen) * dt
      m = Math.max(0, s) * RUN.metresPerS
      p.z = zAt(s)
      p.y = climbY(p.z) + RUN.waterLift
      player.velocity.z = Math.min(slideSpeed, RUN.slideMax)
      hud.setMeter(m)
      hud.setSlideHeight(m)
      if (Math.floor(m / RUN.milestone) < slideMark) sfx.slideMark(--slideMark)
      spray -= dt
      if (spray <= 0) {
        spray = 0.04
        bursts.emit({ layer: 'chunk', count: 7, pos: [p.x, p.y + 0.1, p.z - 0.5], spread: [1.1, 0.05, 0.3], vel: [0, 2.6, -1], jitter: [2, 1.3, 1], gravity: -15, life: 0.5, size: 0.14, color: '#ffffff', color2: '#7feeff' })
      }
      if (s <= 0.3) {
        state = 'fly'
        flyZ = Math.min(slideSpeed, RUN.launchSpeed)
        flyY = RUN.launchUp
        player.grounded = false
        hud.setSlideHeight(0)
        sfx.launch()
        bursts.emit({ layer: 'chunk', count: 34, pos: [p.x, p.y + 0.2, p.z], spread: [1.4, 0.1, 0.4], vel: [0, 5, 3], jitter: [2.6, 2, 2], gravity: -16, life: 0.7, size: 0.2, color: '#ffffff', color2: '#7feeff' })
      }
    } else if (state === 'fly') {
      flyY -= 22 * dt
      p.z += flyZ * dt
      p.y += flyY * dt
      player.velocity.y = flyY
      player.tilt *= 0.9
      if (p.y <= 0.05) land()
    }
  }

  return {
    sliding: () => state === 'hop' || state === 'slide' || state === 'fly',
    carry: () => (state !== 'idle' || (reveal && !reveal.orbOn) ? 'overhead' : held.visible ? 'hold' : null),
    // What the sound follows, once a frame (the same object each time).
    sound() {
      const climbing = state === 'climb'
      sound.climbing = climbing
      sound.zone = zone ? ZONES.indexOf(zone) : 0
      sound.slide = state === 'slide' ? Math.min(1, slideSpeed / (RUN.slideMax * pace)) : 0
      sound.air = state === 'fly' ? 0.8 : state === 'hop' ? 0.4 : state === 'slide' ? 0.3 + 0.5 * sound.slide : climbing ? (0.3 * boost) / RUN.maxBoost : 0
      sound.metres = state === 'idle' ? 0 : m
      const gap = bestAtStart - m // the last stretch to the record
      sound.tension = climbing && bestAtStart > 0 && gap > 0 && gap < AUDIO.nearBest ? 1 - gap / AUDIO.nearBest : 0
      return sound
    },

    // Once a frame: the trigger, the eggs' looks and the hatch.
    update(dt) {
      hud.update(dt, state === 'climb' ? 0.45 + (0.55 * boost) / RUN.maxBoost : state === 'slide' ? 1 : 0)
      if (coins.visible) drawCoins(dt)
      if (state !== 'idle' && player.drive !== tick) {
        // A respawn took the player off the climb.
        state = 'idle'
        coins.visible = false
        mystery.visible = false
        hud.exitRun()
        showHeld()
      }
      if (state === 'idle' && !player.drive) {
        const p = player.position
        const from = N - p.z
        const onStairs = p.x > stairs[0] - 0.2 && p.x < stairs[1] + 0.2
        if (onStairs && player.grounded && from > 0.05 && from < L - 1) start(from)
        // Not a wall: the camera's ray and the ride off the slide would meet it.
        else if (!onStairs && from > RUN.footLimit) resetPlayer({ x: p.x, y: Math.max(p.y, climbY(N - RUN.footLimit)), z: N - RUN.footLimit }, player.facing)
      }
      if (mystery.visible) {
        eggGlow = Math.max(0, eggGlow - dt / 1.4)
        eggPop = Math.max(0, eggPop - dt / 0.3)
        mystery.material.emissiveIntensity = eggGlow * 0.85
        if (!reveal?.orbOn) mystery.scale.setScalar(1 + eggPop * 0.28)
      }
      if (!reveal) return
      reveal.t += dt
      if (!reveal.orbOn && reveal.t >= RUN.orbDelay) {
        reveal.orbOn = true
        reveal.hush = sfx.orbCharge(RUN.orbTime)
        orb.visible = true
        hud.exitRun()
        mystery.position.copy(ORB_AT).setY(0.72)
        mystery.scale.setScalar(0.42)
      }
      if (reveal.orbOn) {
        const t = reveal.t - RUN.orbDelay
        const open = Math.min(1, t / 0.3) * (1 + Math.sin(t * 9) * 0.05)
        orb.scale.setScalar(3.6 * open)
        orb.material.opacity = 0.85
        mystery.rotation.y += dt * (4 + t * 5)
        orb.getWorldPosition(orbWorld)
        if (Math.random() < dt * 22) bursts.emit({ count: 2, pos: [orbWorld.x, orbWorld.y, orbWorld.z], spread: [1.2, 1.2, 1.2], radial: -1.1, life: 0.7, size: 0.3, color: '#6ff4ff', color2: '#ffffff' })
        orbWorld.y += 1.1
        orbWorld.project(camera)
        hud.chip(orbWorld.z < 1 ? { x: (orbWorld.x + 1) / 2, y: (1 - orbWorld.y) / 2, text: `${(reveal.luck + RUN.hatchBonus).toFixed(2)}x` } : null)
        if (t >= RUN.orbTime) {
          bursts.emit({ count: 50, pos: [player.position.x, 1.2, player.position.z], spread: [1.2, 1, 1.2], radial: 5, life: 0.9, size: 0.4, color: '#ffffff', color2: '#6ff4ff' })
          finishReveal()
        }
      }
    },

    toggleAuto,
    start,
    hud,
    // A run or a hatch is under way.
    busy: () => state !== 'idle' || !!reveal,
    setTraining(on) {
      training = on
      showHeld()
    },
    // Strength gained from training, times the equipped trail's multiplier; returns what was added.
    addStrength(n) {
      const gain = gained(n)
      save.strength += gain
      hud.setStrength(save.strength)
      store(save)
      bloxity.submitScore('strength', save.strength)
      return gain
    },
    setStrengthMulti(fn) {
      strengthMulti = fn
    },
    setCoinPay(fn) {
      coinPay = fn
    },
    eggs: stacks,
    slot: () => slot,
    select: selectSlot,
    // The tier of the egg in the player's hand, or null.
    heldTier: () => (held.visible ? (stacks()[slot - 1]?.tierIdx ?? null) : null),
    // Takes the egg in the hand out of the hotbar (the plot has it now).
    takeEgg() {
      const tierIdx = stacks()[slot - 1].tierIdx
      save.eggs.splice(save.eggs.indexOf(tierIdx), 1)
      if (!save.eggs.includes(tierIdx)) slot = 0
      store(save)
      showHeld()
    },
    tap,
    state: () => state,
    drain: () => (strength = 1), // dev: end the run now
  }
}
