// Every one-shot sound in the game, synthesised from physical recipes (synth.js). Nothing here
// throws or plays before the first gesture: each export returns quietly when audio isn't running
// or the voice budget is spent.
//
// Pitched sounds are mallets on wood and soft bells between about A3 and B5, and the climb is
// played, not just heard: each tap is the next note of the zone's song (AUDIO.songs), so a new zone
// is a new tune to reach, coins walk up a scale for the whole run, and the slide walks back down.
// Materials are mode tables [ratio, amplitude, decay s].
import { AUDIO, COARSE_POINTER } from '../config.js'
import { A, isMuted, now, voice } from './core.js'
import { bubble, bubbles, burst, grit, modal, pick, rnd, tone, vary } from './synth.js'

const MARIMBA = [[1, 1, 0.42], [3.98, 0.14, 0.09], [9.2, 0.025, 0.03]]
const KALIMBA = [[1, 1, 0.75], [2.01, 0.1, 0.35], [5.4, 0.06, 0.07]]
const BELL = [[0.5, 0.2, 1.3], [1, 1, 1.1], [2, 0.26, 0.7], [3, 0.08, 0.4], [4.2, 0.025, 0.2]]
const WOOD = [[1, 1, 0.08], [2.57, 0.35, 0.04], [4.2, 0.12, 0.018]]
const KEY = [[1, 1, 0.035], [2.31, 0.3, 0.018]] // a soft rubber button

const C4 = 261.63
const note = (n) => C4 * Math.pow(2, n / 12) // n semitones from middle C
const PENTA = [0, 2, 4, 7, 9] // major pentatonic, for anything that climbs a scale
const pentaAt = (i) => PENTA[i % PENTA.length] + 12 * Math.floor(i / PENTA.length)

// --- Bookkeeping -----------------------------------------------------------------------------
const lastAt = new Map()
// false if `name` played less than `ms` ago (keeps rapid repeats from stacking).
function limit(name, ms) {
  const t = performance.now()
  if (t - (lastAt.get(name) ?? -1e9) < ms) return false
  lastAt.set(name, t)
  return true
}
// A specific sound claims the moment, so the generic purchase sound that fires from the same
// handler (hud.spend) stays quiet.
let claimed = -1e9
const claim = () => (claimed = performance.now())
const claimedRecently = (ms = 80) => performance.now() - claimed < ms

// Phone haptics for the big moments (Android; iOS ignores it).
function buzz(pattern) {
  if (!COARSE_POINTER || isMuted()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not allowed in this frame.
  }
}

// Mallet notes in a row, `gap` s apart; n are semitones from middle C.
function run(t, notes, gap, { gain = 0.2, modes = MARIMBA, verb = 0.2, bus = A.sfx, decay = 1, strike = 0.08 } = {}) {
  notes.forEach((n, i) => modal({ t: t + i * gap, f: note(n), modes, gain: gain * rnd(0.88, 1), strike, decay, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.35, verb, bus }))
}
// Notes struck together.
function chord(t, notes, { gain = 0.13, modes = BELL, verb = 0.3, bus = A.sfx, decay = 1, spread = 0.012 } = {}) {
  notes.forEach((n, i) => modal({ t: t + i * spread, f: note(n), modes, gain, beat: 3, decay, pan: rnd(-0.3, 0.3), verb, bus }))
}
// A low soft drum, felt more than heard.
function timpani(t, gain = 0.4, f = 82) {
  tone({ t, f: f * 1.25, f2: f, glide: 0.05, a: 0.005, d: 0.5, gain })
  tone({ t, f: f * 3, a: 0.005, d: 0.14, gain: gain * 0.4 }) // the part phone speakers can play
  burst({ t, noise: 'brown', type: 'lowpass', f: 380, q: 0.6, a: 0.005, d: 0.2, gain: gain * 0.5 })
}
// Air moving: a filtered noise sweep from f to f2 over a + d s.
const swell = (t, f, f2, a, d, gain, bus = A.sfx) => burst({ t, f, f2, q: 0.8, a, d, gain: gain * 3, bus })

// --- UI ------------------------------------------------------------------------------------------
// HUD button: a short rubber press with a felt-y body thump.
export function click(pan = 0) {
  if (!limit('click', 30) || !voice(0.1, 2)) return
  const t = now()
  const bus = A.ui
  modal({ t, f: vary(620, 0.05), modes: KEY, gain: 0.34, bus, pan, strike: 0.12 })
  tone({ t, f: vary(240, 0.05), f2: 140, d: 0.05, gain: 0.14, bus, pan })
}

// Big chunky button: deeper, a squish under the press.
export function press(pan = 0) {
  if (!limit('click', 30) || !voice(0.12, 2)) return
  const t = now()
  const bus = A.ui
  modal({ t, f: vary(430, 0.05), modes: KEY, gain: 0.36, bus, pan, strike: 0.14 })
  tone({ t, f: vary(200, 0.05), f2: 110, d: 0.07, gain: 0.18, bus, pan })
}

// A card in a list: a light tap on a wooden tile.
export function tick(pan = 0) {
  if (!limit('click', 30) || !voice(0.06, 2)) return
  modal({ t: now(), f: vary(760, 0.06), modes: WOOD, gain: 0.26, bus: A.ui, pan })
}

// Auto Climb and the like: two clicks a few ms apart, up when on and down when off.
export function toggle(on) {
  if (!voice(0.2, 2)) return
  const t = now()
  const bus = A.ui
  modal({ t, f: on ? 520 : 640, modes: KEY, gain: 0.18, bus, strike: 0.1 })
  modal({ t: t + 0.06, f: on ? 700 : 470, modes: KEY, gain: 0.2, bus, strike: 0.1 })
  tone({ t, f: 170, f2: 95, d: 0.05, gain: 0.14, bus })
}

// Window opens: air pushed aside, then the card lands on felt.
export function windowOpen() {
  if (!limit('win', 90) || !voice(0.35, 2)) return
  const t = now()
  const bus = A.ui
  swell(t, 300, 1300, 0.08, 0.14, 0.26, bus)
  tone({ t: t + 0.1, f: 190, f2: 110, d: 0.1, gain: 0.12, bus })
  modal({ t: t + 0.1, f: note(7), modes: MARIMBA, gain: 0.14, decay: 0.5, bus })
}

export function windowClose() {
  if (!limit('win', 90) || !voice(0.2, 2)) return
  swell(now(), 1200, 280, 0.02, 0.13, 0.26, A.ui)
}

// No: two dull knocks on wood. Firm but never a harsh buzzer.
export function deny() {
  if (!limit('deny', 140) || !voice(0.2, 2)) return
  const t = now()
  const bus = A.ui
  modal({ t, f: vary(310, 0.03), modes: WOOD, gain: 0.34, strike: 0.12, bus })
  modal({ t: t + 0.09, f: vary(245, 0.03), modes: WOOD, gain: 0.3, strike: 0.1, bus })
  buzz(30)
}

// Heavy coins dropping into a wooden box: n low clinks, thinning out.
function pour(t, n, spread, gain, pan = 0) {
  for (let i = 0; i < n; i++) {
    const at = t + Math.pow(i / n, 1.3) * spread + rnd(0, 0.02)
    modal({ t: at, f: rnd(620, 1040), modes: KALIMBA, gain: gain * (1 - (i / n) * 0.65), decay: rnd(0.2, 0.4), strike: 0.05, pan: pan + rnd(-0.3, 0.3), verb: 0.08 })
  }
}

// Paying: the box lid clunks, a bell rings once, coins go in.
export function purchase() {
  if (!limit('buy', 200) || !voice(1.2, 3)) return
  const t = now()
  burst({ t, type: 'lowpass', f: 650, q: 0.7, d: 0.1, gain: 0.3 })
  tone({ t, f: 95, f2: 54, d: 0.1, gain: 0.3 })
  modal({ t: t + 0.04, f: note(12), modes: BELL, gain: 0.14, beat: 3, strike: 0.08, verb: 0.15 })
  pour(t + 0.06, COARSE_POINTER ? 5 : 8, 0.42, 0.1)
  buzz([20, 40, 30])
}
// hud.spend: every purchase that has no sound of its own. Waits a task so one fired from the same
// handler wins.
export function paid() {
  setTimeout(() => claimedRecently() || purchase(), 0)
}

// Equip: a latch clicking home and a small lift of air.
export function equip() {
  if (!limit('equip', 120) || !voice(0.4, 2)) return
  const t = now()
  const bus = A.ui
  modal({ t, f: vary(560, 0.04), modes: KEY, gain: 0.18, strike: 0.12, bus })
  modal({ t: t + 0.05, f: note(14), modes: MARIMBA, gain: 0.12, decay: 0.5, bus })
  tone({ t: t + 0.05, f: 200, f2: 120, d: 0.04, gain: 0.18, bus })
  swell(t, 400, 1100, 0.03, 0.1, 0.06, bus)
}

// A soft cork pop: a pet hopping onto the plot, or back to the bench.
export function pop(up = true) {
  if (!limit('pop', 50) || !voice(0.15, 2)) return
  bubble({ t: now(), f: up ? vary(330, 0.08) : vary(560, 0.08), d: 0.09, gain: 0.3, rise: up ? 1.1 : -0.45, bus: A.ui })
}

// Hotbar slot: an egg lifted out of the bag.
export function holster() {
  if (!limit('slot', 60) || !voice(0.15, 2)) return
  const t = now()
  swell(t, 500, 900, 0.02, 0.07, 0.12, A.ui)
  modal({ t: t + 0.05, f: vary(520, 0.04), modes: KEY, gain: 0.14, bus: A.ui })
}

// Day <-> night: a long soft swell of air.
export function dayNight() {
  if (!voice(1.2, 2)) return
  swell(now(), 220, 900, 0.5, 0.6, 0.12)
}

// --- Moving around ---------------------------------------------------------------------------------
// One footfall. surface: AUDIO.surfaces or 'turf'; k 0..1 = how hard.
const FEET = {
  turf: { thump: 0.13, f: 900, q: 0.8, d: 0.05, scuff: 0.09 },
  stone: { thump: 0.16, f: 1250, q: 1.1, d: 0.035, scuff: 0.12 },
  wet: { thump: 0.14, f: 1000, q: 1, d: 0.045, scuff: 0.1, drip: true },
  snow: { thump: 0.11, f: 800, q: 0.9, d: 0.07, scuff: 0.08, grit: 5 },
  cloud: { thump: 0.13, f: 420, q: 0.7, d: 0.1, scuff: 0.13 },
  sand: { thump: 0.1, f: 1100, q: 0.7, d: 0.09, scuff: 0.09, grit: 3 },
  rock: { thump: 0.2, f: 680, q: 1.2, d: 0.05, scuff: 0.14 },
}
let side = 1
export function step(surface = 'turf', k = 0.6) {
  if (!limit('step', 95) || !voice(0.15, 1)) return
  const s = FEET[surface] ?? FEET.turf
  const t = now()
  side = -side
  const pan = side * 0.07
  const level = (0.55 + 0.45 * k) * rnd(0.82, 1)
  tone({ t, f: vary(210, 0.08), f2: 110, d: 0.055, gain: s.thump * level, pan })
  burst({ t, f: vary(s.f, 0.14), q: s.q, a: 0.003, d: s.d, gain: s.scuff * 6 * level, pan })
  if (s.grit) grit({ t: t + 0.01, n: s.grit, dur: 0.06, gain: 0.05 * level })
  if (s.drip) bubble({ t: t + 0.015, f: rnd(380, 620), d: 0.05, gain: 0.05 * level, rise: 0.5, pan })
}

// Springing up: a push off the ground, a little lift of air and a bouncy pitch.
export function jump() {
  if (!limit('jump', 150) || !voice(0.25, 1)) return
  const t = now()
  swell(t, 320, 950, 0.03, 0.11, 0.13)
  tone({ t, f: vary(250, 0.05), f2: 540, glide: 0.11, a: 0.008, d: 0.12, gain: 0.17 })
  tone({ t, f: 170, f2: 100, d: 0.05, gain: 0.12 })
}

// Landing (k 0..1 = how hard): a thud and a puff.
export function land(k = 0.5, surface = 'turf') {
  if (!limit('land', 120) || !voice(0.4, 1)) return
  const t = now()
  k = Math.max(0.25, Math.min(1, k))
  tone({ t, f: vary(92, 0.06), f2: 50, d: 0.13, gain: 0.3 * k })
  tone({ t, f: vary(260, 0.06), f2: 130, d: 0.08, gain: 0.26 * k })
  burst({ t, noise: 'brown', type: 'lowpass', f: 480, q: 0.6, a: 0.003, d: 0.14, gain: 0.4 * k })
  burst({ t: t + 0.01, f: FEET[surface]?.f ?? 900, q: 0.7, a: 0.008, d: 0.14, gain: 0.34 * k })
}

// Back at the start of the world: air rushing in and one soft bell.
export function respawn() {
  if (!limit('respawn', 400) || !voice(0.9, 2)) return
  const t = now()
  swell(t, 1300, 320, 0.05, 0.28, 0.2)
  modal({ t: t + 0.08, f: note(12), modes: BELL, gain: 0.08, verb: 0.3 })
}

// --- The climb -------------------------------------------------------------------------------------
// The song of a zone: [arpeggio of each chord], from its triads, walked one note per tap.
const PATTERN = [0, 2, 3, 4, 3, 2, 3, 1]
const songs = AUDIO.songs.map(({ key, chords }) => chords.map(([a, b, c]) => PATTERN.map((i) => key + [a, b, c, a + 12, b + 12][i])))
let song = 0
let tapAt = 0 // notes played of this song
// Which zone's song the taps play, and back to its first bar.
export function setSong(i) {
  if (song !== i) tapAt = 0
  song = i
}

// One tap, the next note of the song. power 0..1 = the boost: the harder they tap the fuller it
// gets, a soft fifth under the note and the bass on the bar. auto: quieter, it goes on for hours.
export function tap(power = 0, auto = false) {
  if (!limit('tap', AUDIO.tapGap) || !voice(0.5, 1)) return
  const t = now()
  const bars = songs[song]
  const i = tapAt++
  const bar = bars[Math.floor(i / (PATTERN.length * 2)) % bars.length]
  const n = bar[i % PATTERN.length]
  const level = (auto ? AUDIO.autoTap : 1) * (i % 4 === 0 ? 1 : rnd(0.7, 0.85))
  modal({ t, f: note(n), modes: MARIMBA, gain: 0.46 * level, strike: 0.14, pan: rnd(-0.12, 0.12), verb: 0.09 })
  if (power > 0.45 && i % 2 === 0) modal({ t, f: note(n - 5), modes: MARIMBA, gain: 0.2 * level * power, verb: 0.06 })
  if (power > 0.2 && i % PATTERN.length === 0) modal({ t, f: note(bar[0] - 12), modes: MARIMBA, gain: 0.34 * level, decay: 1.5, verb: 0.06 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 300, q: 0.6, a: 0.002, d: 0.035, gain: (0.08 + 0.1 * power) * level })
}

// Holding the boost at its top: the air opens up behind the player.
export function fullPower() {
  if (!limit('full', 2000) || !voice(0.8, 2)) return
  const t = now()
  swell(t, 260, 1500, 0.3, 0.3, 0.17)
  run(t + 0.12, [0, 7, 12].map((n) => n + AUDIO.songs[song].key), 0.07, { gain: 0.09 })
}

// A run starts: the egg lifted overhead.
export function runStart() {
  if (!voice(0.7, 2)) return
  const t = now()
  swell(t, 300, 1000, 0.1, 0.16, 0.14)
  tone({ t, f: 165, f2: 330, glide: 0.16, a: 0.012, d: 0.17, gain: 0.14 })
  run(t + 0.1, [0, 7].map((n) => n + AUDIO.songs[song].key), 0.09, { gain: 0.15 })
}

// A coin, the i-th of the run: each one a step up the scale, so a long streak is a long climb. The
// top of the ladder folds back an octave instead of going shrill.
export function coin(i = 0) {
  if (!voice(0.8, 2)) return
  const t = now()
  const span = PENTA.length * 3
  const step = i % span
  const n = pentaAt(step) + AUDIO.songs[song].key - 5
  modal({ t, f: note(n), modes: KALIMBA, gain: 0.26, strike: 0.08, pan: rnd(-0.15, 0.15), verb: 0.14 })
  modal({ t: t + 0.055, f: note(n + 7), modes: KALIMBA, gain: 0.14, decay: 0.7, pan: rnd(-0.15, 0.15), verb: 0.14 })
  if ((i + 1) % PENTA.length === 0) chord(t + 0.11, [n, n + 4, n + 7], { gain: 0.07, decay: 0.7 }) // every fifth a small flourish
}

// A distance pop (each RUN.milestone m): a soft wooden knock with the bar's root under it.
export function milestone(i = 0) {
  if (!voice(0.5, 1)) return
  const t = now()
  const n = pentaAt(i % 10) + AUDIO.songs[song].key
  modal({ t, f: note(n), modes: WOOD, gain: 0.22, decay: 1.6, strike: 0.08 })
  modal({ t: t + 0.08, f: note(n + 12), modes: MARIMBA, gain: 0.12, decay: 0.7, verb: 0.15 })
}

// Over a speed pad: a rubbery spring and a rush of air, three notes shooting up.
export function speedPad() {
  if (!limit('pad', 400) || !voice(0.9, 2)) return
  const t = now()
  tone({ t, f: 110, f2: 330, glide: 0.2, a: 0.01, d: 0.24, gain: 0.2 })
  swell(t, 300, 1700, 0.14, 0.32, 0.26)
  timpani(t, 0.14, 98)
  run(t + 0.08, [0, 7, 12].map((n) => n + AUDIO.songs[song].key), 0.06, { gain: 0.14 })
  buzz(25)
}

// A checkpoint (0 = the first tier, 5 = Mythic): a drum, then a chord that grows with the tier.
export function tier(i = 0) {
  if (!voice(2, 3)) return
  claim()
  const t = now()
  const key = AUDIO.songs[Math.min(i, AUDIO.songs.length - 1)].key
  timpani(t, 0.4)
  run(t + 0.04, [0, 4, 7, 12, 16].slice(0, 3 + Math.min(i, 2)).map((n) => n + key), 0.07, { gain: 0.17, modes: KALIMBA, verb: 0.25 })
  chord(t + 0.3, [-12, 0, 4, 7, 12].map((n) => n + key), { gain: 0.09 + 0.008 * i })
  buzz(40)
}

// Into a new zone: a long breath of its air, under the checkpoint's chord.
export function zone() {
  if (!voice(1.6, 2)) return
  const t = now()
  swell(t, 220, 900, 0.7, 0.8, 0.14)
}

// Passing the player's best mid-climb: the drum roll, the fanfare, the song's key resolved.
export function record() {
  if (!voice(3, 4)) return
  claim()
  const t = now()
  const key = AUDIO.songs[song].key
  for (let i = 0; i < 7; i++) timpani(t + i * 0.055, 0.1 + i * 0.03, 90)
  run(t + 0.36, [0, 4, 7, 12, 7, 12, 16].map((n) => n + key), 0.09, { gain: 0.2, modes: KALIMBA, verb: 0.3 })
  chord(t + 1, [-12, 0, 7, 12, 16].map((n) => n + key), { gain: 0.12, decay: 1.3 })
  buzz([40, 60, 40, 60, 80])
}

// So close to the best: a heartbeat under the climb (index.js paces it).
export function heartbeat(k = 0.5) {
  if (!voice(0.4, 1)) return
  const t = now()
  for (const [at, g] of [[0, 1], [0.16, 0.7]]) {
    tone({ t: t + at, f: 66, f2: 48, d: 0.14, gain: (0.12 + 0.08 * k) * g })
    tone({ t: t + at, f: 190, f2: 130, d: 0.08, gain: (0.08 + 0.08 * k) * g })
  }
}

// The bar is nearly empty: two low notes falling, once a run.
export function lowStrength() {
  if (!voice(0.7, 2)) return
  const key = AUDIO.songs[song].key
  run(now(), [7, 3].map((n) => n + key), 0.16, { gain: 0.16, decay: 1.2 })
}

// Out of strength: the player kicks off the stairs. A boing and the air under them.
export function hop() {
  if (!voice(0.6, 2)) return
  const t = now()
  tone({ t, f: 240, f2: 620, glide: 0.2, a: 0.012, d: 0.24, gain: 0.22 })
  swell(t, 300, 1100, 0.1, 0.25, 0.1)
  tone({ t, f: 160, f2: 90, d: 0.06, gain: 0.16 })
}

// Water splash: the impact thud, soft spray, then bubbles and the drops coming back down.
export function splash(size = 1) {
  if (!voice(1.2, 2)) return
  const t = now()
  const k = COARSE_POINTER ? 0.6 : 1
  burst({ t, type: 'lowpass', f: 700, f2: 220, q: 0.7, a: 0.005, d: 0.24 * size, gain: 0.45 * Math.min(1.4, size) })
  tone({ t, f: 92, f2: 48, d: 0.15, gain: 0.3 * Math.min(1.4, size) })
  burst({ t, f: 1500, f2: 700, q: 0.5, a: 0.012, d: 0.42 * size, gain: 0.16 * size, verb: 0.12 })
  bubbles({ t, n: Math.round(22 * size * k), dur: 0.4 * size, f0: 220, f1: 1100, gain: 0.1, verb: 0.1 })
  bubbles({ t: t + 0.22 * size, n: Math.round(10 * size * k), dur: 0.5 * size, f0: 500, f1: 1500, gain: 0.05 })
}

// A height mark going past on the way down: a water drop on the song's scale, falling a step each
// time, so the ride pays out the same ladder the climb went up. i counts down.
export function slideMark(i = 0) {
  if (!voice(0.4, 1)) return
  const t = now()
  const step = ((i % 15) + 15) % 15
  const f = note(pentaAt(step) + AUDIO.songs[song].key - 5)
  bubble({ t, f, d: 0.11, gain: 0.2, rise: 0.22, pan: rnd(-0.3, 0.3), verb: 0.18 })
  modal({ t, f, modes: MARIMBA, gain: 0.08, decay: 0.6, verb: 0.14 })
}

// Off the foot of the slide: the ramp throws them up, water tearing away, the air opening.
export function launch() {
  if (!voice(1.1, 2)) return
  const t = now()
  tone({ t, f: 180, f2: 620, glide: 0.34, a: 0.015, d: 0.36, gain: 0.17 })
  swell(t, 420, 1500, 0.08, 0.5, 0.26)
  bubbles({ t, n: COARSE_POINTER ? 8 : 16, dur: 0.3, f0: 360, f1: 1300, gain: 0.09 })
  buzz(30)
}

// The landing at the end of a run (k 0..1 = how fast): the biggest thud in the game, a puff of
// sand around it and the chord that says it is over.
export function touchdown(k = 0.6) {
  if (!voice(1.2, 3)) return
  const t = now()
  const level = 0.6 + 0.4 * k
  timpani(t, 0.65 * level, 68)
  tone({ t, f: 240, f2: 120, d: 0.11, gain: 0.3 * level })
  burst({ t, f: 900, f2: 340, q: 0.6, a: 0.008, d: 0.38, gain: 0.5 * level, verb: 0.15 })
  grit({ t: t + 0.04, n: COARSE_POINTER ? 7 : 14, dur: 0.3, gain: 0.05 })
  buzz(60)
}

// The sums at the end of a run. Strength gained: a soft rising third. Coins: a note for each, up
// to a handful. newBest resolves on the home chord. near: within AUDIO.nearMiss of the best, the
// tune stops one step short of home, so the ear wants one more run.
export function result({ newBest = false, near = false, coins = 0 }) {
  if (!voice(2.8, 3)) return
  claim()
  const t = now() + 0.3
  const key = AUDIO.songs[song].key
  run(t, [0, 4].map((n) => n + key), 0.1, { gain: 0.16 })
  const count = Math.min(coins, 6)
  if (count) run(t + 0.24, Array.from({ length: count }, (_, i) => pentaAt(i) + 2 + key), 0.07, { gain: 0.1, modes: KALIMBA, decay: 0.5 })
  const after = t + 0.3 + count * 0.07
  if (newBest) {
    run(after, [0, 4, 7, 12, 16].map((n) => n + key), 0.09, { gain: 0.2, modes: KALIMBA, verb: 0.3 })
    chord(after + 0.5, [-12, 0, 7, 12, 16].map((n) => n + key), { gain: 0.13, decay: 1.4 })
    timpani(after + 0.5, 0.3)
  } else if (near) {
    run(after, [7, 9, 11].map((n) => n + key), 0.14, { gain: 0.16, verb: 0.3 })
    chord(after + 0.46, [-5, 2, 5, 11].map((n) => n + key), { gain: 0.08, decay: 0.9 }) // the dominant, unresolved
  }
}

// --- Hatching --------------------------------------------------------------------------------------
// The orb opens and turns for `dur` s: a low swell climbing and mallets coming faster. stop() ends
// it early (a new run starts through the reveal).
export function orbCharge(dur) {
  if (!voice(dur, 3)) return () => {}
  const ctx = A.ctx
  const t = now()
  const out = ctx.createGain()
  out.gain.value = 1
  out.connect(A.sfx)
  const bus = out
  burst({ t, f: 240, f2: 1300, q: 1.3, a: dur * 0.9, d: 0.1, gain: 0.4, bus })
  tone({ t, f: 196, f2: 392, glide: dur, a: 0.6, hold: dur - 0.7, d: 0.12, gain: 0.06, bus })
  tone({ t, f: 294, f2: 587, glide: dur, a: 0.6, hold: dur - 0.7, d: 0.12, gain: 0.03, bus })
  let at = t + 0.1
  let gap = 0.3
  let i = 0
  while (at < t + dur - 0.05) {
    modal({ t: at, f: note(pentaAt(i++ % 11) - 5), modes: MARIMBA, gain: 0.14 + ((at - t) / dur) * 0.14, decay: 0.7, verb: 0.12, bus })
    at += gap
    gap = Math.max(0.075, gap * 0.87)
  }
  return () => {
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
    setTimeout(() => out.disconnect(), 300)
  }
}

// Shell breaking: dull cracks, a little grit.
export function eggCrack() {
  if (!voice(0.3, 2)) return
  const t = now()
  for (let i = 0; i < 3; i++) {
    const at = t + i * rnd(0.03, 0.06)
    burst({ t: at, f: rnd(700, 1400), q: 1.6, a: 0.002, d: 0.018, gain: 0.3 })
    modal({ t: at, f: rnd(420, 700), modes: WOOD, gain: 0.17, decay: 0.7 })
  }
  grit({ t, n: 8, dur: 0.15, gain: 0.07 })
}

// The reveal, bigger for a rarer tier (0..5). lucky: the roll came up a tier better, so a second
// flourish answers the first.
export function reveal(rarity = 0, lucky = false) {
  if (!voice(2.8, 4)) return
  claim()
  const t = now()
  eggCrack()
  bubble({ t, f: 300, d: 0.11, gain: 0.32, rise: 1.3 })
  timpani(t, 0.26 + rarity * 0.05)
  const runs = [[0, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12, 16], [-5, 0, 4, 7, 12, 16], [-5, 0, 4, 7, 12, 16, 19], [-12, -5, 0, 4, 7, 12, 16, 19]]
  const notes = runs[Math.max(0, Math.min(5, rarity))]
  run(t + 0.07, notes, 0.07, { gain: 0.2, modes: KALIMBA, verb: 0.3 })
  const end = t + 0.07 + notes.length * 0.07
  if (rarity >= 2) chord(end, [-12, 0, 7, 12, 16], { gain: 0.09 + rarity * 0.012, decay: 0.9 + rarity * 0.12 })
  if (lucky) run(end + 0.28, [7, 12, 16, 19], 0.08, { gain: 0.17, modes: BELL, decay: 0.5, verb: 0.35 })
  buzz(rarity >= 3 ? [40, 50, 40, 50, 80] : 30)
}

// An egg set down on the plot: a soft weight on grass.
export function eggPlace() {
  if (!voice(0.3, 2)) return
  const t = now()
  tone({ t, f: 130, f2: 74, d: 0.08, gain: 0.3 })
  burst({ t, f: 620, q: 0.7, a: 0.004, d: 0.06, gain: 0.14 })
  modal({ t: t + 0.03, f: note(0), modes: WOOD, gain: 0.14, decay: 1.2 })
}

// An egg rocking for `dur` s before it hatches: wooden knocks coming faster.
export function eggWobble(dur = 0.9) {
  if (!voice(dur, 2)) return
  const t = now()
  let at = t + 0.03
  let gap = 0.2
  while (at < t + dur - 0.03) {
    modal({ t: at, f: rnd(300, 390), modes: WOOD, gain: 0.16 + ((at - t) / dur) * 0.14, strike: 0.05, pan: rnd(-0.2, 0.2) })
    at += gap * rnd(0.9, 1.1)
    gap = Math.max(0.07, gap * 0.8)
  }
}

// --- The base and the rewards -----------------------------------------------------------------------
// Lifting: a rep at the top of the press. Each is the next note of a slow scale, so a long set
// keeps going somewhere, and it starts over an octave down rather than climbing out of range.
export function rep(i = 0, boosted = false) {
  if (!voice(0.5, 1)) return
  const t = now()
  tone({ t, f: vary(170, 0.05), f2: 100, d: 0.07, gain: 0.14 })
  burst({ t, noise: 'brown', type: 'lowpass', f: 340, q: 0.6, a: 0.003, d: 0.05, gain: 0.14 })
  modal({ t: t + 0.015, f: note(pentaAt(i % 11) - 5), modes: MARIMBA, gain: boosted ? 0.36 : 0.28, strike: 0.08, verb: 0.08, pan: rnd(-0.2, 0.2) })
}

export function trainStart() {
  if (!voice(0.5, 2)) return
  const t = now()
  tone({ t, f: 170, f2: 340, glide: 0.14, a: 0.01, d: 0.2, gain: 0.16 })
  swell(t, 280, 760, 0.08, 0.14, 0.1)
}

export function trainStop() {
  if (!voice(0.4, 2)) return
  const t = now()
  burst({ t, noise: 'brown', type: 'lowpass', f: 420, q: 0.6, a: 0.003, d: 0.12, gain: 0.26 })
  tone({ t, f: 150, f2: 80, d: 0.11, gain: 0.18 })
  modal({ t, f: 330, modes: WOOD, gain: 0.26, strike: 0.08 })
}

// The x2 hand: a quick lift of air and a higher note.
export function trainBoost() {
  if (!limit('boost', 110) || !voice(0.3, 1)) return
  const t = now()
  swell(t, 420, 1100, 0.03, 0.09, 0.12)
  modal({ t, f: note(pick([12, 14, 16])), modes: KALIMBA, gain: 0.18, decay: 0.4 })
}

// The x2 hand appearing: two soft rising notes, an invitation rather than an alert.
export function trainHand() {
  if (!limit('hand', 300) || !voice(0.4, 1)) return
  const t = now()
  modal({ t, f: note(7), modes: KALIMBA, gain: 0.14, decay: 0.35 })
  modal({ t: t + 0.09, f: note(14), modes: KALIMBA, gain: 0.12, decay: 0.45 })
}

// The base upgraded: a heavy latch, then the plot's chord opening.
export function upgrade() {
  if (!voice(1.3, 3)) return
  claim()
  const t = now()
  timpani(t, 0.3, 92)
  modal({ t, f: 300, modes: WOOD, gain: 0.3, strike: 0.1 })
  run(t + 0.1, [0, 4, 7, 12], 0.08, { gain: 0.16, modes: KALIMBA })
  chord(t + 0.44, [0, 7, 12, 16], { gain: 0.08 })
  buzz([20, 40, 30])
}

// A sale: coins into the box, more for a bigger handful.
export function sell(n = 1) {
  if (!limit('sell', 120) || !voice(1, 2)) return
  claim()
  const t = now()
  tone({ t, f: 110, f2: 62, d: 0.08, gain: 0.2 })
  pour(t, Math.min(COARSE_POINTER ? 7 : 12, 3 + n * 2), 0.4, 0.13)
  modal({ t: t + 0.04, f: note(7), modes: BELL, gain: 0.08, strike: 0.05, verb: 0.15 })
}

// A claimed reward: paper torn, the lid off, a run of notes.
export function gift() {
  if (!voice(1.4, 3)) return
  claim()
  const t = now()
  grit({ t, n: COARSE_POINTER ? 8 : 14, dur: 0.22, gain: 0.1, f0: 600, f1: 2000 })
  tone({ t: t + 0.2, f: 230, f2: 120, d: 0.07, gain: 0.2 })
  bubble({ t: t + 0.25, f: 300, d: 0.1, gain: 0.26, rise: 1.2 })
  run(t + 0.3, [0, 4, 7, 12, 16], 0.07, { gain: 0.18, modes: KALIMBA, verb: 0.25 })
  buzz([20, 40, 40])
}

// The portal's blessing: a slow swell into a wide chord.
export function portal() {
  if (!voice(2.4, 4)) return
  claim()
  const t = now()
  swell(t, 200, 1200, 0.8, 0.2, 0.12)
  timpani(t + 0.84, 0.3, 62)
  chord(t + 0.86, [-24, -12, 0, 7, 12, 16], { gain: 0.11, decay: 1.5, spread: 0.04 })
  buzz([0, 800, 80, 60, 80])
}

// Rebirth: a swell rushing in, a deep boom, a warm chord ringing out.
export function rebirth() {
  if (!voice(3.2, 5)) return
  claim()
  const t = now()
  swell(t, 190, 1500, 0.7, 0.08, 0.16)
  const hit = t + 0.74
  tone({ t: hit, f: 72, f2: 34, glide: 1.1, d: 1.4, gain: 0.36 })
  tone({ t: hit, f: 216, f2: 108, glide: 0.5, d: 0.5, gain: 0.2 })
  burst({ t: hit, noise: 'brown', type: 'lowpass', f: 420, q: 0.6, a: 0.005, d: 1.2, gain: 0.36, verb: 0.3 })
  chord(hit + 0.03, [-12, 0, 4, 7, 12, 16], { gain: 0.13, decay: 1.5, spread: 0.03 })
  run(hit + 0.3, [12, 16, 19, 24], 0.1, { gain: 0.13, modes: KALIMBA, verb: 0.35 })
  buzz([0, 740, 120, 60, 80])
}

// Far-off thunder in the dunes: all rumble, no crack.
export function thunder() {
  if (!voice(2.6, 1)) return
  const t = now()
  const pan = rnd(-0.6, 0.6)
  burst({ t, noise: 'brown', type: 'lowpass', f: 300, f2: 90, q: 0.5, a: 0.06, d: 2.2, gain: 0.42, pan, verb: 0.3 })
  burst({ t: t + rnd(0.15, 0.4), noise: 'brown', type: 'lowpass', f: 180, f2: 70, q: 0.5, a: 0.2, d: 1.3, gain: 0.3, pan: -pan * 0.5 })
}
