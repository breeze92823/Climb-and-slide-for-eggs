import './rebirthWindow.css'
import { REBIRTH } from './config.js'
import { CASH } from './indexWindow.js'
import { formatCash } from './lobbyHud.js'
import { createWindow } from './uiWindow.js'
import { COIN } from './weightShop.js'
import * as bloxity from './bloxity.js'
import * as saves from './saves.js'

// The Rebirth window, off the Rebirth button. Each rebirth spends its price in cash and adds
// x1 to the base's cash multiplier; pets, strength and eggs stay. Measured off the reference
// (rebirthWindow.css). Saved through saves.js. Skip Rebirth's price
// has no system yet.
const ARROW = `<svg viewBox="0 0 64 56" aria-hidden="true"><path d="M4 18h28V5l28 23-28 23V38H4Z" fill="#f4f8fc" stroke="#1a1a22" stroke-width="5" stroke-linejoin="round"/><path d="M8 34h28v8l18-14" fill="none" stroke="#9fb4c8" stroke-width="4" stroke-linejoin="round"/></svg>`

function load() {
  try {
    return saves.load(REBIRTH.saveKey)?.count ?? 0
  } catch {
    return 0 // No storage, or a bad save.
  }
}

const el = (parent, className, html = '') => {
  const e = document.createElement('div')
  e.className = className
  e.innerHTML = html
  parent.append(e)
  return e
}

// hud: the lobby HUD (cash, spend, comingSoon, setRebirthReady).
export function createRebirthWindow({ hud }) {
  let count = load()
  const listeners = new Set()
  const cost = () => REBIRTH.cost * REBIRTH.growth ** count

  const win = createWindow({ title: 'Rebirth:', className: 'rb-window', onOpen: refresh })
  const number = document.createElement('span')
  number.className = 'rb-number uiw-text'
  win.head.querySelector('h2').after(number)

  const steps = el(win.body, 'rb-steps')
  const step = () => {
    const s = el(steps, 'rb-step', `<div class="rb-label uiw-text"></div><div class="rb-stat"><span class="rb-cash">${CASH}</span><span class="rb-value uiw-text"></span></div>`)
    return { label: s.querySelector('.rb-label'), value: s.querySelector('.rb-value') }
  }
  const now = step()
  el(steps, 'rb-arrow', ARROW)
  const next = step()

  el(win.body, 'rb-note uiw-text').textContent = 'Rebirth only consumes Cash'
  const bar = el(win.body, 'rb-bar', '<div class="rb-fill"></div><span class="uiw-text"></span>')
  const fill = bar.querySelector('.rb-fill')
  const barText = bar.querySelector('span')

  const buttons = el(win.body, 'rb-buttons')
  const button = (className, html, fn) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `rb-button ${className}`
    b.innerHTML = html
    b.addEventListener('click', fn)
    buttons.append(b)
    return b
  }
  const go = button('rb-go', '<span class="uiw-text">Rebirth</span>', rebirth)
  button('rb-skip', `<span class="uiw-text">Skip Rebirth</span><span class="rb-price uiw-text">${COIN}<span>${REBIRTH.coin}</span></span>`, () => hud.comingSoon('Skip Rebirth'))

  function refresh() {
    number.textContent = count
    now.label.textContent = `Rebirth ${count}`
    now.value.textContent = `x${count + 1} Cash`
    next.label.textContent = `Rebirth ${count + 1}`
    next.value.textContent = `x${count + 2} Cash`
    showCash()
  }

  function showCash() {
    const have = hud.cash()
    fill.style.width = `${Math.min(have / cost(), 1) * 100}%`
    const text = `Cash: ${formatCash(have)}$/${formatCash(cost())}$`
    if (barText.textContent !== text) barText.textContent = text
    go.classList.toggle('off', have < cost())
  }

  function rebirth() {
    if (!hud.spend(cost())) return hud.toast('Not enough Cash!')
    count++
    try {
      saves.store(REBIRTH.saveKey, { count })
    } catch {
      // Storage blocked: the rebirth lasts this session.
    }
    bloxity.submitScore('rebirths', count)
    refresh()
    for (const fn of listeners) fn()
  }

  return {
    ...win,
    multi: () => count + 1,
    onChange: (fn) => listeners.add(fn),
    // Once a frame: the HUD button's mark and the open window's bar.
    update() {
      hud.setRebirthReady(hud.cash() >= cost())
      if (win.isOpen()) showCash()
    },
  }
}
