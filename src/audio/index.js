// Game audio, the one import the rest of the game uses:
//   import { sfx, installAudio, updateAudio } from './audio/index.js'
// installAudio() once the save is in (it starts on the first gesture), then updateAudio(dt, state)
// every frame for the footsteps, jumps and landings, the slide's rush and the wind, and
// sfx.<name>() for one-shots. Every button press anywhere gets its click here (one capture-phase
// listener), so the windows need no wiring of their own.
import { AUDIO, CLIMB, RUN } from '../config.js'
import { A, installCore, onStart, setAdBreak, setDucked, setMuted, setVolume, toggleMuted } from './core.js'
import * as loops from './loops.js'
import * as sfx from './sfx.js'

export { sfx, setAdBreak, setDucked, setMuted, setVolume, toggleMuted }
export const chargeOn = loops.chargeOn
export const chargeOff = loops.chargeOff

// Presses on anything clickable. The buttons skipped here say more than a click, from their own
// handlers; the lobby's big cards and tabs get the deeper press.
function onPress(e) {
  if (e.button > 0) return
  const b = e.target.closest?.('button, [role="button"]')
  if (!b || b.disabled || b.closest('.lh-prompt, .rh-slot, .lh-pack, .rh-x2, .rh-auto, .sw-auto')) return
  const pan = Math.max(-0.6, Math.min(0.6, (e.clientX / window.innerWidth - 0.5) * 1.2)) // a press on the left sounds left
  if (b.classList.contains('ix-tab')) sfx.tick(pan)
  else if (b.classList.contains('touch-btn')) sfx.click(pan)
  else if (b.classList.contains('lh-card') || b.classList.contains('lh-tab')) sfx.press(pan)
  else sfx.click(pan)
}

export function installAudio() {
  installCore()
  // After the core's unlock listener (same phase, registered later), so the context exists.
  window.addEventListener('pointerdown', onPress, { capture: true, passive: true })
}

const prev = { x: 0, z: 0, grounded: true, vy: 0, driven: false, strideAt: 0, init: false }
let beat = 0
let started = false
onStart(() => (started = true))

// Per-frame state from main.js: { player: { x, z, grounded, vy, driven }, stride: the animator's
// phase while it runs, or null, speed (m/s), run: run.sound() }.
export function updateAudio(dt, { player: p, stride, speed, run }) {
  if (!started || !A.ctx || A.ctx.state !== 'running') return
  const surface = run.climbing ? AUDIO.surfaces[run.zone] : 'turf'
  if (prev.init) {
    if (Math.hypot(p.x - prev.x, p.z - prev.z) > 12) sfx.respawn() // teleported
    else if (!p.driven && !prev.driven) {
      if (prev.grounded && !p.grounded && p.vy > 2) sfx.jump()
      if (!prev.grounded && p.grounded && prev.vy < -3) sfx.land(Math.min(1, -prev.vy / 16), surface)
    }
  }
  // A foot comes down at the two ends of the stride.
  if (stride !== null) {
    const at = Math.floor(stride / Math.PI + 0.5)
    if (at !== prev.strideAt) sfx.step(surface, Math.min(1, speed / 14))
    prev.strideAt = at
  }
  prev.x = p.x
  prev.z = p.z
  prev.grounded = p.grounded
  prev.vy = p.vy
  prev.driven = p.driven
  prev.init = true

  // The last stretch to the record: a heart that speeds up.
  if (run.tension > 0) {
    beat -= dt
    if (beat <= 0) {
      beat = AUDIO.heart[0] + (AUDIO.heart[1] - AUDIO.heart[0]) * run.tension
      sfx.heartbeat(run.tension)
    }
  } else beat = 0

  loops.update(dt, {
    slide: run.slide,
    air: run.air,
    height: Math.min(1, run.metres / (CLIMB.length * RUN.metresPerS)),
  })
}
