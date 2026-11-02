// The climb's HUD (styles in climbHud.css), drawn off the reference screenshots at 1920x990.
// Lobby: Auto Climb, strength, hotbar. On a run they make way for the strength bar, the tap
// prompt, the checkpoint banner and the rainbow meter. Nothing here knows the rules: climbRun.js
// calls it. Everything is DOM except the speed lines, one small canvas drawn while they show.
import './climbHud.css'
import { RUN, TRAIN } from './config.js'
import { formatCash } from './lobbyHud.js'

const MUSCLE = '<svg viewBox="0 0 64 64"><path d="M9 38c2-11 10-14 17-11 1-6-1-10-6-11-3-1-4-5-1-8 5-4 16-3 21 2 5 6 3 13 2 16 8-1 15 3 16 12 1 11-8 19-22 19-16 0-29-7-27-19Z" fill="#f2b84d" stroke="#3a2410" stroke-width="4" stroke-linejoin="round"/><path d="M26 27c5 3 7 8 6 13M18 45c8 6 22 7 32-1" fill="none" stroke="#b77a24" stroke-width="3" stroke-linecap="round"/></svg>'
const CLOVER = '<svg viewBox="0 0 64 64"><g fill="#35c52e" stroke="#14701a" stroke-width="3" stroke-linejoin="round"><path d="M31 31C17 33 8 25 13 15c4-7 10-7 13-4 2-5 10-6 13 0 3 7-2 15-8 20Z"/><path d="M33 31c13-9 25-5 25 6 0 7-6 10-10 9 1 5-4 11-11 9-8-3-8-15-4-24Z"/><path d="M31 33c-1 13-11 20-20 14-6-4-5-11-2-13-4-4-2-11 4-12 9-1 15 5 18 11Z"/><path d="M32 33c4 9 5 15 11 25" fill="none" stroke-width="5" stroke-linecap="round"/></g></svg>'
const LADDER = '<svg viewBox="0 0 40 72"><g transform="rotate(-20 20 36)"><rect x="4" y="2" width="32" height="68" fill="#f6f4ee" stroke="#2c2c34" stroke-width="3"/><path d="M12 4v64M28 4v64M12 14h16M12 28h16M12 42h16M12 56h16M12 14l16 14M28 14 12 28M12 42l16 14M28 42 12 56" fill="none" stroke="#3a3a44" stroke-width="3"/></g></svg>'
const HAND = '<svg viewBox="0 0 120 92"><path d="M6 24c-4 7 2 13 10 13l40 1c-3 7-1 14 5 19-3 8 2 14 9 14 2 6 9 9 15 6 7 6 19 4 27-4 11-12 8-36-4-46-9-8-25-11-38-6L19 16C13 14 8 19 6 24Z" fill="#ffc21f" stroke="#111" stroke-width="6" stroke-linejoin="round"/><path d="M60 57c6 1 12 0 16-3M70 71c5 0 9-2 12-5M85 77c3-1 6-3 7-5M56 38c7 0 13-1 18-5" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/></svg>'
const FACE = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#f0c8ff" stroke="#d070ff" stroke-width="5"/><path d="M15 34c0-13 8-19 17-19s17 6 17 19c0 11-8 19-17 19s-17-8-17-19Z" fill="#f2c79a"/><path d="M13 31c-1-14 9-21 19-21s20 7 19 21c-5-7-11-9-19-9s-14 2-19 9Z" fill="#6a4426"/><rect x="17" y="30" width="13" height="8" rx="3" fill="#15151c"/><rect x="34" y="30" width="13" height="8" rx="3" fill="#15151c"/><path d="M29 33h6" stroke="#15151c" stroke-width="2"/></svg>'
const POINTER = '<svg viewBox="0 0 64 64"><path d="M28 8V3M17 12l-3-4M39 12l3-4M13 22H8" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><path d="M22 17c0-5 8-5 8 0v15l3-.5c2-3 7-2 7 1l3-.5c2-2 7-1 7 2l1 .5c3-1 6 1 6 4v8c0 8-6 14-14 14H36c-6 0-9-2-12-7L13 39c-3-5 3-9 7-5l2 2Z" fill="#fff" stroke="#15151b" stroke-width="3.5" stroke-linejoin="round"/></svg>'
const DUMBBELL = '<svg viewBox="0 0 64 64"><g transform="rotate(-45 32 32)"><rect x="6" y="20" width="12" height="24" rx="3" fill="#5d6a78" stroke="#1c2026" stroke-width="3"/><rect x="46" y="20" width="12" height="24" rx="3" fill="#5d6a78" stroke="#1c2026" stroke-width="3"/><rect x="18" y="28" width="28" height="8" fill="#a9b4bf" stroke="#1c2026" stroke-width="3"/></g></svg>'

function el(parent, className, html = '') {
  const e = document.createElement('div')
  e.className = className
  e.innerHTML = html
  parent.append(e)
  return e
}

// Restarts a CSS animation on an element.
function replay(e, name = 'on') {
  e.classList.remove(name)
  void e.offsetWidth
  e.classList.add(name)
}

// Where each metre sits on the meter, 0..1 up it: a tier fills its segment on the way to the next.
const shares = RUN.tiers.map((t) => t.meter)
const meterTotal = shares.reduce((a, b) => a + b, 0)
function meterAt(m) {
  let below = 0
  for (let i = 0; i < RUN.tiers.length; i++) {
    const from = i === 0 ? 0 : RUN.tiers[i].m
    const to = RUN.tiers[i + 1]?.m ?? RUN.tiers[i].m * 1.5
    if (m < to) return (below + (shares[i] * (m - from)) / (to - from)) / meterTotal
    below += shares[i]
  }
  return 1
}

export function createClimbHud({ onAuto, onSlot }) {
  const root = el(document.body, 'rh-root')

  // --- Speed lines -----------------------------------------------------------------------
  const lines = document.createElement('canvas')
  lines.className = 'rh-lines'
  root.append(lines)
  const ctx = lines.getContext('2d')
  const streaks = Array.from({ length: 14 }, () => ({ life: 0 }))
  let linesOn = false
  const sizeLines = () => {
    lines.width = Math.round(window.innerWidth / 2)
    lines.height = Math.round(window.innerHeight / 2)
  }
  window.addEventListener('resize', sizeLines)
  sizeLines()

  function drawLines(dt, power) {
    if (!power) {
      if (linesOn) ctx.clearRect(0, 0, lines.width, lines.height)
      linesOn = false
      return
    }
    linesOn = true
    const w = lines.width
    const h = lines.height
    const reach = Math.hypot(w, h) / 2
    ctx.clearRect(0, 0, w, h)
    for (const k of streaks) {
      k.life -= dt
      if (k.life <= 0) {
        if (Math.random() > power * 0.6) continue
        k.angle = Math.random() * Math.PI * 2
        k.spread = 0.006 + Math.random() * 0.012
        k.life = k.max = 0.22 + Math.random() * 0.22
        k.from = 0.5 + Math.random() * 0.25
        k.length = 0.22 + Math.random() * 0.3
      }
      const t = 1 - k.life / k.max
      const r0 = (k.from - t * 0.22) * reach
      const r1 = r0 + k.length * reach
      const cos = Math.cos(k.angle)
      const sin = Math.sin(k.angle)
      ctx.globalAlpha = Math.sin(t * Math.PI) * 0.65
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(w / 2 + cos * r0, h / 2 + sin * r0)
      ctx.lineTo(w / 2 + Math.cos(k.angle - k.spread) * r1, h / 2 + Math.sin(k.angle - k.spread) * r1)
      ctx.lineTo(w / 2 + Math.cos(k.angle + k.spread) * r1, h / 2 + Math.sin(k.angle + k.spread) * r1)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // --- Always on: Auto Climb --------------------------------------------------------------
  const auto = document.createElement('button')
  auto.type = 'button'
  auto.className = 'rh-auto rh-text'
  auto.innerHTML = `<span class="rh-auto-icon">${LADDER}</span><span class="rh-auto-label"></span>`
  auto.addEventListener('click', onAuto)
  root.append(auto)

  // --- Lobby: strength and hotbar ----------------------------------------------------------
  const stats = el(root, 'rh-stats rh-text', `<span class="rh-icon">${MUSCLE}</span><span class="rh-stat"></span>`)
  const statValue = stats.querySelector('.rh-stat')
  const hotbar = el(root, 'rh-hotbar rh-text')

  // --- Training: STOP TRAIN, the x2 hand --------------------------------------------------------
  let trainActions = null
  const trainButton = (className, html, action) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = className
    b.innerHTML = html
    b.addEventListener('click', () => trainActions?.[action]())
    root.append(b)
    return b
  }
  trainButton('rh-stop rh-text', 'STOP TRAIN', 'stop')
  const x2 = trainButton('rh-x2', `<span class="rh-x2-art">${POINTER}<span class="rh-x2-word rh-text">x${TRAIN.boost}</span></span>`, 'press')

  // --- Run: bottom bar and tap prompt ------------------------------------------------------
  const run = el(root, 'rh-run')
  const bar = el(run, 'rh-bar', `<div class="rh-bar-fill"></div><div class="rh-bar-value rh-text"><span class="rh-icon">${MUSCLE}</span><span class="rh-bar-num"></span></div>`)
  const barFill = bar.querySelector('.rh-bar-fill')
  const barNum = bar.querySelector('.rh-bar-num')
  el(run, 'rh-prompt rh-text', 'Tap to Climb Faster!')
  const hand = el(run, 'rh-tap', `<span class="rh-tap-ring"></span><span class="rh-tap-word rh-text">Tap</span><span class="rh-tap-hand">${HAND}</span>`)
  const luck = el(run, 'rh-luck rh-text', `<span class="rh-luck-icon">${CLOVER}</span><span class="rh-luck-num"></span>`)
  const luckNum = luck.querySelector('.rh-luck-num')
  const pop = el(run, 'rh-pop rh-text')

  const banner = el(run, 'rh-banner rh-text', '<div class="rh-banner-top"></div><div class="rh-banner-sub"></div>')
  const bannerTop = banner.querySelector('.rh-banner-top')
  const bannerSub = banner.querySelector('.rh-banner-sub')

  const meter = el(run, 'rh-meter')
  for (const tier of RUN.tiers) el(meter, 'rh-seg').style.cssText = `flex-grow:${tier.meter};background:${tier.bar}`
  const face = el(meter, 'rh-face', FACE)

  const tagEl = el(root, 'rh-tag rh-text')
  const head = el(root, 'rh-head rh-text')
  const flash = el(root, 'rh-flash')
  const chip = el(root, 'rh-chip rh-text', `<span class="rh-luck-icon">${CLOVER}</span><span></span>`)
  const chipText = chip.lastElementChild
  const height = el(root, 'rh-height rh-text')
  const best = el(root, 'rh-best rh-text', '<div class="rh-best-word">NEW BEST!</div><div class="rh-best-m"></div>')
  const bestM = best.querySelector('.rh-best-m')
  const gainEl = el(root, 'rh-gain rh-text')

  let shownBar = -1
  let shownLuck = ''
  let shownBanner = ''
  let lastHeight = -1

  return {
    update: drawLines,

    setAuto(on) {
      auto.querySelector('.rh-auto-label').textContent = `Auto Climb: ${on ? 'ON' : 'OFF'}`
      auto.classList.toggle('on', on)
    },
    setStrength(n) {
      statValue.textContent = formatCash(n)
    },
    onTraining(actions) {
      trainActions = actions
    },
    setTraining(on) {
      root.classList.toggle('training', on)
      document.body.classList.toggle('training', on)
    },
    boosted() {
      replay(x2, 'press')
    },
    // A "+2 Strength" somewhere on the screen, which then flies into the counter.
    strengthPop(gain) {
      const { x, y } = TRAIN.popArea
      const left = (x[0] + Math.random() * (x[1] - x[0])) * window.innerWidth
      const top = (y[0] + Math.random() * (y[1] - y[0])) * window.innerHeight
      const to = stats.getBoundingClientRect()
      const pop = el(root, 'rh-lift rh-text', `<span class="rh-icon">${MUSCLE}</span><span class="rh-lift-word">+${formatCash(gain)} Strength</span>`)
      pop.style.cssText = `left:${left}px;top:${top}px;--to-x:${to.left + to.height / 2 - left}px;--to-y:${to.top + to.height / 2 - top}px`
      pop.addEventListener('animationend', () => pop.remove())
    },
    // eggs: stacks of { tier, count }, slot: selected (0 = the dumbbell).
    setHotbar(eggs, slot) {
      hotbar.textContent = ''
      const add = (i, html) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = `rh-slot${i === slot ? ' on' : ''}`
        b.innerHTML = `<span class="rh-slot-n">${i + 1}</span>${html}`
        b.addEventListener('click', () => onSlot(i))
        hotbar.append(b)
      }
      add(0, DUMBBELL)
      eggs.forEach(({ tier, count }, i) => add(i + 1, `<span class="rh-slot-egg" style="background:${tier.color}"></span>${count > 1 ? `<span class="rh-slot-count">x${count}</span>` : ''}`))
    },

    enterRun() {
      document.body.classList.add('run-active')
      root.classList.add('running')
      root.classList.remove('sliding')
      height.classList.remove('on')
      best.classList.remove('on')
      gainEl.classList.remove('on')
      shownBanner = ''
    },
    slideMode() {
      root.classList.add('sliding')
      lastHeight = -1
    },
    exitRun() {
      document.body.classList.remove('run-active')
      root.classList.remove('running', 'sliding')
    },

    setBar(value, max) {
      const n = Math.ceil(value)
      if (n === shownBar) return
      shownBar = n
      barNum.textContent = n
      barFill.style.width = `${(100 * value) / max}%`
      const low = value / max < RUN.lowStrength
      bar.classList.toggle('low', low)
      root.classList.toggle('low', low)
    },
    setLuck(value) {
      const text = `${value.toFixed(2)}x`
      if (text === shownLuck) return
      shownLuck = text
      luckNum.textContent = text
      luck.classList.toggle('on', value >= 1.01)
    },
    setBanner(b) {
      const key = b ? `${b.number}:${Math.ceil(b.left)}` : ''
      if (key === shownBanner) return
      shownBanner = key
      banner.classList.toggle('on', !!b)
      if (!b) return
      bannerTop.textContent = `CHECKPOINT ${b.number}`
      bannerSub.textContent = `${b.tier.name.toUpperCase()} EGG • ${Math.ceil(b.left)}m`
      bannerSub.style.color = b.tier.color
    },
    setMeter(m) {
      face.style.bottom = `${meterAt(m) * 100}%`
    },
    setSlideHeight(m) {
      const n = Math.round(m)
      if (n === lastHeight) return
      lastHeight = n
      height.textContent = `${n}m`
      height.classList.add('on')
    },

    tapped() {
      replay(hand, 'press')
    },
    tag(tier) {
      tagEl.textContent = `${tier.name.toUpperCase()}!`
      tagEl.style.color = tier.color
      replay(tagEl)
    },
    milestone(m) {
      pop.textContent = `${m}m`
      replay(pop)
    },
    headline(text) {
      head.textContent = text
      replay(head)
    },
    result({ metres, newBest, gain }) {
      bestM.textContent = `${metres}m`
      if (newBest) replay(best)
      gainEl.textContent = `+${gain} STRENGTH`
      replay(gainEl)
    },
    flash(color) {
      flash.style.background = color
      replay(flash)
    },
    // Luck over the hatch orb: { x, y (0..1 of the screen), text }, or null.
    chip(c) {
      chip.classList.toggle('on', !!c)
      if (!c) return
      chip.style.left = `${c.x * 100}%`
      chip.style.top = `${c.y * 100}%`
      chipText.textContent = c.text
    },
  }
}
