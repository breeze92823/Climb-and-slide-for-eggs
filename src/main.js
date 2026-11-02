import { Clock, Group, LinearToneMapping, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { CAMERA, graphicsPreset, RENDER, SPAWN } from './config.js'
import * as bloxity from './bloxity.js'
import { install as installInput, onKey, onKeyUp } from './input.js'
import { installTouch } from './touch.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn } from './player.js'
import { setCameraSensitivity, syncYawToPlayer, update as updateCamera } from './camera.js'
import { onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { createWorld, worldColliders } from './world.js'
import { createPostFx } from './postfx.js'
import { setNeonBloom } from './propkit.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { closeTopWindow, setWindowReserved } from './uiWindow.js'
import { createIndexWindow } from './indexWindow.js'
import { createClimbRun } from './climbRun.js'
import { createLobbyHud } from './lobbyHud.js'
import { createBaseFarm } from './baseFarm.js'
import { createTraining } from './training.js'
import { createWeightShop } from './weightShop.js'
import { createTrailShop } from './trailShop.js'
import { createStallPrompts } from './stallPrompts.js'
import { createRebirthWindow } from './rebirthWindow.js'
import { createPlaytimeWindow } from './playtimeWindow.js'
import { createPetsWindow } from './petsWindow.js'
import { createDailyWindow } from './dailyWindow.js'
import { createSellWindow } from './sellWindow.js'
import { createEggsWindow } from './eggsWindow.js'
import * as petIndex from './petIndex.js'
import * as net from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import * as saves from './saves.js'

// Boot order: Bloxity SDK -> renderer -> Rapier (async wasm) -> ground + sky + lighting,
// player body -> avatar (async, swaps in when ready) -> loop. The SDK is optional at every step.
let lighting = null
let renderer = null
let postfx = null
let world = null

// Settings come from the portal's settings menu (or their defaults offline).
function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'fullscreen') bloxity.requestFullscreen(value)
  else if (key === 'graphics_quality' && renderer) {
    const next = graphicsPreset(value)
    renderer.shadowMap.enabled = next.shadows
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.dpr))
    lighting?.setShadows(next)
    postfx?.configure(next)
    setNeonBloom(next.bloom)
    world?.configure(next)
    postfx?.setSize(window.innerWidth, window.innerHeight)
  }
}
bloxity.onSetting(applySetting)
bloxity.init()

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = LinearToneMapping // the brick palette is shown as painted
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(() => closeTopWindow() || bloxity.showMenu(), renderer.domElement) // Esc closes an open window, else opens the portal menu

const scene = new Scene()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
postfx = createPostFx(renderer, scene, camera)
postfx.configure(preset)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

for (const key of Object.keys(bloxity.settings)) applySetting(key, bloxity.settings[key])

// --- Physics + ground + sky --------------------------------------------------
bloxity.loadingStep('Starting physics')
await initPhysics()

lighting = createLighting(scene, renderer, preset)
world = createWorld(scene)
world.configure(preset)
worldColliders()
createPlayerBody()
syncYawToPlayer()

// --- Player avatar ----------------------------------------------------------
// The Bloxity base rig (player.glb; procedural fallback if it fails), dressed
// with the signed-in player's equipped cosmetics and body proportions. It
// rebuilds on customizer edits and sign-in/out.
const playerGroup = new Group()
playerGroup.rotation.order = 'YXZ'
scene.add(playerGroup)
let avatar = null
let animator = null
let generation = 0
let avatarReady = false

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  disposeAnimator(animator)
  avatar = next
  playerGroup.add(avatar)
  animator = makeAnimator(avatar)
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  try {
    const group = await loadBaseCharacter()
    if (mine !== generation) return
    const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
    await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
    if (mine !== generation) return
    applyProportions(group, bloxity.authState.user ? bloxity.getProportions() : null)
    setAvatar(group)
  } finally {
    if (mine === generation) avatarReady = true
  }
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
bloxity.onAvatarChanged(loadAvatar)
bloxity.onProportionsChanged(() => applyProportions(avatar, bloxity.getProportions()))
bloxity.onRespawnRequest(respawn)

// --- Modes + keys --------------------------------------------------------------
onModeChanged((mode) => {
  playerGroup.visible = mode !== 'player' // first person: you are the camera
})
onKey('KeyV', toggleMode)
onKey('KeyN', () => lighting.toggleDayNight())
onKey('KeyR', respawn)
installTouch({ mode: toggleMode, day: () => lighting.toggleDayNight(), respawn })

// --- Save ---------------------------------------------------------------------
// The player's progress comes from the game server before any system loads its part (saves.js);
// with no server (or a guest) it is the browser's copy. A different player signing in later
// reloads the page, so a save is never mixed with another account's.
await bloxity.authSettled()
const saveOwner = net.identity()
saves.setNamespace(saveOwner)
bloxity.loadingStep('Loading your progress')
await net.start()
petIndex.loadIndex()
bloxity.subscribeAuth(() => {
  if (net.identity() !== saveOwner) location.reload()
})

// Boxity's ad breaks pause the game (there is no audio to mute yet).
let adBreak = false
bloxity.onAdBreak((on) => (adBreak = on))

// --- Windows ----------------------------------------------------------------
const indexWindow = createIndexWindow()
onKey('KeyI', indexWindow.toggle)

// --- Climb run --------------------------------------------------------------
const run = createClimbRun({ scene, group: playerGroup, camera, world })
onKey('KeyC', run.toggleAuto)

// --- Lobby HUD --------------------------------------------------------------
const travel = ({ x, z, facing }) => {
  resetPlayer({ x, y: SPAWN.y, z }, facing)
  syncYawToPlayer()
}
const lobbyHud = createLobbyHud({ travel, run, indexWindow })
const trails = createTrailShop({ hud: lobbyHud, scene })
run.setStrengthMulti(trails.multi)
onKey('KeyG', lobbyHud.backpack.toggle)
const rebirth = createRebirthWindow({ hud: lobbyHud })
const farm = createBaseFarm({ scene, camera, world, run, hud: lobbyHud, rebirth })
onKey('KeyE', lobbyHud.press)
onKeyUp('KeyE', lobbyHud.release)
const playtime = createPlaytimeWindow({ hud: lobbyHud, farm })
const daily = createDailyWindow({ hud: lobbyHud, farm })
const sellWindow = createSellWindow({ hud: lobbyHud, farm })
lobbyHud.setWindows({ pets: createPetsWindow({ hud: lobbyHud, farm }), rebirth, gift: playtime, daily, sell: sellWindow, eggs: createEggsWindow({ hud: lobbyHud, farm }), trails })
const shop = createWeightShop({ hud: lobbyHud, bases: world.bases, run, camera })
const stalls = createStallPrompts({ hud: lobbyHud, camera, sell: sellWindow, run })
const training = createTraining({ group: playerGroup, world, run, shop })
bloxity.onReservedAreas((areas) => {
  setWindowReserved(areas)
  lobbyHud.fitNav(areas)
})

// --- Other players ---------------------------------------------------------
const remotes = createRemotePlayers({ scene, camera, localGroup: playerGroup, localPosition: player.renderPosition, maxDrawn: preset.remotes })

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let shownLoading = true
let readySince = 0

renderer.setAnimationLoop(() => {
  const dt = adBreak ? (clock.getDelta(), 0) : Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  const elapsed = clock.elapsedTime

  stepPhysics(dt) // runs the player controller + world at the fixed rate, interpolates bodies
  interpolatePlayer()

  const p = player.renderPosition
  playerGroup.position.set(p.x, p.y, p.z)
  playerGroup.rotation.set(player.tilt, player.facing, 0)
  animator?.update(dt, {
    grounded: player.grounded,
    speed: Math.hypot(player.velocity.x, player.velocity.z),
    verticalVelocity: player.velocity.y,
    turn: 0,
    slide: run.sliding(),
    carry: run.carry(),
    lift: training.lift(),
  })

  updateCamera(camera, dt)
  world.update(elapsed, camera, renderer)
  run.update(dt)
  training.update()
  shop.update()
  trails.update(dt)
  stalls.update()
  lobbyHud.update(dt)
  farm.update(dt, elapsed)
  remotes.update(dt)
  rebirth.update()
  playtime.update()
  daily.update()
  lighting.update(dt, playerGroup.position)
  bloxity.setAdScreen(run.busy() ? null : 'lobby') // banner ads only while the player is in the lobby
  postfx.render()

  // Loading ends once the scene has drawn and the avatar has had its chance (max ~5 s).
  if (shownLoading) {
    readySince += dt
    if (avatarReady || readySince > 5) {
      shownLoading = false
      bloxity.notifyFirstFrame()
    }
  }
})

window.addEventListener('beforeunload', () => {
  net.flush()
  bloxity.teardown()
})

// Dev-only console hook, e.g. __game.teleport(-24, 0, 6, Math.PI / 2)
if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  window.__game = { net, remotes, player, scene, renderer, camera, postfx, bodies: bodyCount, toggleMode, teleport, index: petIndex, indexWindow, run, farm, training, shop, trails, rebirth, playtime, hud: lobbyHud }
}
