// Synthesis building blocks for the one-shots (sfx.js). Each one schedules a few native nodes at
// time `t` and lets them be collected when they end. The rule of the game's sound is warm over
// bright: sines and filtered pink or brown noise only, no square or saw waves and no white noise,
// and attacks of a few ms rather than a click.
//  - burst(): filtered noise with an envelope (impacts, whooshes, spray, footfalls)
//  - modal(): a struck object as a sum of decaying modes (marimba, wood, soft bells)
//  - bubble(): a Minnaert bubble, a decaying sine whose pitch rises as it collapses
//  - tone(): a pitched partial with glide (thumps, springs, swells)
// Every call takes random variation (vary) so repeats never machine-gun.
import { AUDIO } from '../config.js'
import { A, now } from './core.js'

export const rnd = (lo, hi) => lo + Math.random() * (hi - lo)
export const vary = (x, pct) => x * (1 + (Math.random() * 2 - 1) * pct)
export const pick = (list) => list[Math.floor(Math.random() * list.length)]

// Routes `node` to a bus with optional pan and reverb send; returns the gain to drive.
export function route(node, { bus = A.sfx, pan = 0, verb = 0 } = {}) {
  const ctx = A.ctx
  let last = node
  if (pan) {
    const p = ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    last.connect(p)
    last = p
  }
  last.connect(bus)
  if (verb > 0) {
    const s = ctx.createGain()
    s.gain.value = verb
    last.connect(s).connect(A.verb)
  }
  return last
}

// Attack/decay envelope on a gain param: linear attack, exponential decay to silence.
export function env(param, t, attack, peak, decay, hold = 0) {
  param.setValueAtTime(0.0001, t)
  param.linearRampToValueAtTime(peak, t + attack)
  if (hold) param.setValueAtTime(peak, t + attack + hold)
  param.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay)
  return t + attack + hold + decay
}

function noiseSource(kind, t, dur) {
  const src = A.ctx.createBufferSource()
  const buf = A.noise[kind] ?? A.noise.pink
  src.buffer = buf
  src.loop = true
  src.start(t, Math.random() * (buf.duration - 0.1))
  src.stop(t + dur + 0.05)
  return src
}

// Filtered noise burst.
// { t, noise: 'pink'|'brown', type: biquad type, f, f2 (sweep end), q, a, d, hold,
//   gain, pan, verb, bus, sweep: seconds for f -> f2 (default the whole sound) }
export function burst(o) {
  const ctx = A.ctx
  const t = o.t ?? now()
  const a = o.a ?? 0.004
  const d = o.d ?? 0.1
  const dur = a + (o.hold ?? 0) + d
  const src = noiseSource(o.noise ?? 'pink', t, dur)
  const f = ctx.createBiquadFilter()
  f.type = o.type ?? 'bandpass'
  f.frequency.setValueAtTime(o.f ?? 800, t)
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.sweep ?? dur))
  f.Q.value = o.q ?? 1
  const g = ctx.createGain()
  env(g.gain, t, a, o.gain ?? 0.5, d, o.hold ?? 0)
  src.connect(f).connect(g)
  route(g, o)
  return t + dur
}

// Pitched partial: { t, f, f2, glide, a, d, hold, gain, pan, verb, bus }. Always a sine.
export function tone(o) {
  const ctx = A.ctx
  const t = o.t ?? now()
  const a = o.a ?? 0.004
  const d = o.d ?? 0.2
  const dur = a + (o.hold ?? 0) + d
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(o.f, t)
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide ?? dur))
  if (o.detune) osc.detune.value = o.detune
  const g = ctx.createGain()
  env(g.gain, t, a, o.gain ?? 0.3, d, o.hold ?? 0)
  osc.connect(g)
  osc.start(t)
  osc.stop(t + dur + 0.05)
  route(g, o)
  return t + dur
}

// Struck object. modes: [[ratio, amp, decay s], ...] relative to f. beat: detune cents of the twin
// of each mode, a slow shimmer; strike: level of the soft mallet thud; a: attack s.
export function modal(o) {
  const ctx = A.ctx
  const t = o.t ?? now()
  const a = o.a ?? 0.003
  const out = ctx.createGain()
  out.gain.value = o.gain ?? 0.3
  route(out, o)
  let end = t
  for (const [ratio, amp, decay] of o.modes) {
    const f = o.f * ratio * (1 + (Math.random() - 0.5) * (o.spread ?? 0.003))
    if (f > AUDIO.ceiling) continue // an overtone up there would only read as a tick
    const twins = o.beat ? [-o.beat / 2, o.beat / 2] : [0]
    for (const cents of twins) {
      const osc = ctx.createOscillator()
      osc.frequency.value = f
      osc.detune.value = cents
      const g = ctx.createGain()
      const d = decay * (o.decay ?? 1)
      env(g.gain, t, a, amp / twins.length, d)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + d + a + 0.05)
      end = Math.max(end, t + d)
    }
  }
  if (o.strike) burst({ t, type: 'lowpass', f: Math.min(1800, o.f * 2), q: 0.6, a: 0.002, d: 0.018, gain: o.strike, bus: out })
  return end
}

// One Minnaert bubble: f Hz, d s; its pitch rises by `rise` while it rings.
export function bubble({ t, f, d = 0.04, gain = 0.1, rise = 0.25, pan = 0, verb = 0, bus = A.sfx }) {
  const ctx = A.ctx
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(f, t)
  osc.frequency.exponentialRampToValueAtTime(f * (1 + rise), t + d)
  const g = ctx.createGain()
  env(g.gain, t, 0.003, gain, d)
  osc.connect(g)
  osc.start(t)
  osc.stop(t + d + 0.04)
  route(g, { bus, pan, verb })
}

// A cloud of bubbles over `dur` s, densest at the start: n bubbles between f0..f1 Hz.
export function bubbles({ t, n, dur, f0, f1, gain = 0.08, d = [0.03, 0.08], rise = 0.3, width = 0.6, verb = 0, bus = A.sfx }) {
  for (let i = 0; i < n; i++) {
    const at = t + Math.pow(Math.random(), 1.8) * dur
    const f = f0 * Math.pow(f1 / f0, Math.pow(Math.random(), 0.8))
    bubble({ t: at, f, d: rnd(d[0], d[1]), gain: gain * rnd(0.4, 1), rise: rise * rnd(0.6, 1.4), pan: rnd(-width, width), verb, bus })
  }
}

// Soft grit (sand, snow, shell): n tiny low-passed noise grains over dur s.
export function grit({ t, n, dur, gain = 0.1, f0 = 500, f1 = 1800, width = 0.3, bus = A.sfx }) {
  for (let i = 0; i < n; i++) {
    burst({ t: t + Math.random() * dur, f: rnd(f0, f1), q: rnd(0.8, 2), a: 0.002, d: rnd(0.012, 0.035), gain: gain * rnd(0.4, 1), pan: rnd(-width, width), bus })
  }
}
