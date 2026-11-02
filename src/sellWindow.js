import './sellWindow.css'
import { SELL } from './config.js'
import { petInfo } from './baseFarm.js'
import { formatCash } from './lobbyHud.js'
import { renderArt } from './petArt.js'
import { sfx } from './audio/index.js'
import { createWindow } from './uiWindow.js'
import * as saves from './saves.js'

// The Sell Animals window, off the Sell tab inside the plot: the spare pets (the ones not on the
// plot) with their prices, Sell All, and Auto Sell, which sells a pet as soon as it is spare.
// Measured off the reference (sellWindow.css). Pets on the plot are never sold. Auto Sell is
// saved through saves.js.
const LOCK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V7a6 6 0 0 1 12 0v3" fill="none" stroke="#15151b" stroke-width="3"/><rect x="3" y="10" width="18" height="13" rx="3" fill="#8a8a90" stroke="#15151b" stroke-width="2.4"/></svg>`
const price = (pet) => petInfo(pet.id).cash * SELL.mult

function loadAuto() {
  try {
    return !!saves.load(SELL.saveKey)?.auto
  } catch {
    return false // No storage, or a bad save.
  }
}

// hud: the lobby HUD (addCash, toast). farm: the plot, which owns the pets.
export function createSellWindow({ hud, farm }) {
  let auto = loadAuto()
  const art = new Map() // pet id -> picture
  const win = createWindow({ title: 'Sell Animals', className: 'sw-window', onOpen: opened })

  const top = document.createElement('div')
  top.className = 'sw-top'
  top.innerHTML = `<span class="sw-label uiw-text">Total Price:</span><span class="sw-total uiw-text"></span><button type="button" class="sw-all"><span class="uiw-text">Sell All $</span></button>`
  win.body.append(top)
  const total = top.querySelector('.sw-total')
  const all = top.querySelector('.sw-all')

  const list = document.createElement('div')
  list.className = 'sw-list'
  win.body.append(list)

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'sw-auto'
  toggle.innerHTML = '<span class="sw-dot"></span><span class="uiw-text">Auto Sell</span>'
  win.stack.append(toggle)

  const spare = () => farm.list().filter((p) => !p.on)

  function pay(pets) {
    let sum = 0
    for (const p of pets) {
      const amount = price(p)
      if (farm.sell(p)) sum += amount
    }
    if (!sum) return
    sfx.sell(pets.length)
    hud.addCash(sum)
    hud.toast(`Sold for $${formatCash(sum)}`)
  }

  function card(entry) {
    const info = petInfo(entry.id)
    const c = document.createElement('div')
    c.className = 'sw-card'
    c.dataset.pet = entry.id
    c.style.setProperty('--sw-tier', info.tier.color)
    c.innerHTML = `<div class="sw-name uiw-text"></div><div class="sw-pic"><img alt="" draggable="false"></div><div class="sw-kind uiw-text">Normal</div><div class="sw-price uiw-text"></div><button type="button" class="sw-sell"><span class="uiw-text">Sell $</span></button>`
    c.querySelector('.sw-name').textContent = info.name
    c.querySelector('.sw-price').textContent = `${formatCash(price(entry))}$`
    c.querySelector('.sw-sell').addEventListener('click', () => pay([entry]))
    paint(c)
    return c
  }

  function paint(c) {
    const src = art.get(c.dataset.pet)
    if (src) c.querySelector('img').src = src
  }

  function refresh() {
    const pets = spare()
    total.textContent = `${formatCash(pets.reduce((sum, p) => sum + price(p), 0))}$`
    all.classList.toggle('off', !pets.length)
    toggle.classList.toggle('on', auto)
    if (!win.isOpen()) return
    const scroll = list.scrollTop
    list.replaceChildren(...pets.map(card))
    if (!pets.length) list.innerHTML = '<div class="lh-soon uiw-text">No spare pets. Unequip one to sell it.</div>'
    list.scrollTop = scroll
  }

  let selling = false
  function change() {
    if (auto && !selling) {
      selling = true
      pay(spare())
      selling = false
    }
    refresh()
  }

  function opened() {
    refresh()
    renderArt((id, a) => {
      art.set(id, a.color)
      for (const c of list.querySelectorAll(`[data-pet="${id}"]`)) paint(c)
    })
  }

  all.addEventListener('click', () => pay(spare()))
  toggle.addEventListener('click', () => {
    auto = !auto
    sfx.toggle(auto)
    try {
      saves.store(SELL.saveKey, { auto })
    } catch {
      // Storage blocked: the switch lasts this session.
    }
    change()
  })
  farm.onChange(change)
  refresh()
  return win
}
