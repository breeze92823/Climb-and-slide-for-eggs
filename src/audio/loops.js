// The sounds that go on rather than happen: the rush of water and air under a slide, the wind that
// grows with height, and the tone that climbs while E is held. Each is one chain of native nodes
// built once; update() only moves their levels, so nothing here allocates per frame.
import { AUDIO, COARSE_POINTER, LOBBY_HUD } from '../config.js'
import { A, onStart, ready } from './core.js'
import { bubble, rnd } from './synth.js'

const M = AUDIO.loops
const s = { ok: false, rush: null, rushLow: null, rushFilter: null, sway: null, wind: null, windFilter: null, charge: null, chargeGain: null }

const filt = (type, f, q = 0.7) => {
  const b = A.ctx.createBiquadFilter()
  b.type = type
  b.frequency.value = f
  b.Q.value = q
  return b
}
const gain = (v) => {
  const g = A.ctx.createGain()
  g.gain.value = v
  return g
}
function loop(buf) {
  const src = A.ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.start(0, Math.random() * (buf.duration - 0.1))
  return src
}
// A slow sine that pushes `param` around, so a bed of noise breathes instead of hissing flat.
function drift(param, rate, depth) {
  const o = A.ctx.createOscillator()
  o.frequency.value = rate
  o.connect(gain(depth)).connect(param)
  o.start()
}

onStart((ctx) => {
  const bus = A.world
  // Slide: water (pink through a lowpass that opens with speed) over a low body, swaying side to
  // side as the player rides the channel.
  s.sway = ctx.createStereoPanner()
  s.sway.connect(bus)
  drift(s.sway.pan, 0.31, 0.35)
  s.rush = gain(0)
  s.rushFilter = filt('lowpass', M.rushLow, 0.6)
  drift(s.rushFilter.detune, 0.73, 220)
  loop(A.noise.pinkStereo).connect(s.rushFilter).connect(s.rush).connect(s.sway)
  s.rushLow = gain(0)
  loop(A.noise.brownStereo).connect(filt('lowpass', 260, 0.6)).connect(s.rushLow).connect(s.sway)
  // Wind: pink through a wide band that wanders; only ever a bed, never a whistle.
  s.wind = gain(0)
  s.windFilter = filt('bandpass', M.windLow, 0.5)
  drift(s.windFilter.detune, 0.17, 300)
  const gusts = gain(1)
  drift(gusts.gain, 0.09, M.windDrift)
  loop(A.noise.pinkStereo).connect(s.windFilter).connect(gusts).connect(s.wind).connect(bus)
  // Hold: one sine a little under the mallets, gated by chargeGain.
  s.charge = ctx.createOscillator()
  s.charge.frequency.value = M.chargeFrom
  s.chargeGain = gain(0)
  s.charge.connect(s.chargeGain).connect(A.ui)
  s.charge.start()
  s.ok = true
})

// While E is held on a hold prompt: the tone rises to the moment it fires.
export function chargeOn() {
  if (!s.ok || !ready()) return
  const t = A.ctx.currentTime
  s.charge.frequency.cancelScheduledValues(t)
  s.charge.frequency.setValueAtTime(M.chargeFrom, t)
  s.charge.frequency.exponentialRampToValueAtTime(M.chargeTo, t + LOBBY_HUD.holdTime)
  s.chargeGain.gain.setTargetAtTime(M.charge, t, 0.04)
}
export function chargeOff() {
  if (s.ok) s.chargeGain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.03)
}

let drip = 0
// Once a frame. slide: speed share 0..1 (0 off the slide); air: how much air is rushing past,
// 0..1; height: the share of the climb under the player.
export function update(dt, { slide, air, height }) {
  if (!s.ok) return
  const t = A.ctx.currentTime
  s.rush.gain.setTargetAtTime(slide > 0 ? M.rush * (0.45 + 0.55 * slide) : 0, t, slide > 0 ? 0.06 : 0.14)
  s.rushLow.gain.setTargetAtTime(slide > 0 ? M.rushBody * (0.5 + 0.5 * slide) : 0, t, slide > 0 ? 0.06 : 0.14)
  s.rushFilter.frequency.setTargetAtTime(M.rushLow + (M.rushHigh - M.rushLow) * slide, t, 0.08)
  const wind = M.wind * Math.max(height * height, air)
  s.wind.gain.setTargetAtTime(wind, t, 0.25)
  s.windFilter.frequency.setTargetAtTime(M.windLow + (M.windHigh - M.windLow) * Math.max(height, air), t, 0.3)
  // Water plipping along the channel, thicker with speed.
  if (slide <= 0 || !ready()) return
  drip += dt * (M.drips[0] + (M.drips[1] - M.drips[0]) * slide) * (COARSE_POINTER ? 0.5 : 1)
  while (drip >= 1) {
    drip--
    bubble({ t: t + 0.02 + Math.random() * 0.04, f: rnd(260, 900), d: rnd(0.04, 0.09), gain: rnd(0.03, 0.08), rise: rnd(0.2, 0.6), pan: rnd(-0.5, 0.5), bus: A.world })
  }
}
