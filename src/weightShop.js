import './weightShop.css'
import { WEIGHTS } from './config.js'
import { formatCash } from './lobbyHud.js'
import { player } from './player.js'
import { screenPoint } from './stallPrompts.js'
import { createWindow } from './uiWindow.js'
import { renderWeights, weightGeometry } from './weightArt.js'
import * as saves from './saves.js'

// The Treadmill Shop, opened by holding E on the Upgrades pad. The player owns weights, one is
// equipped: it pays its strength per rep (training.js) and is the one on the pad and lifted.
// Saved through saves.js. Robux prices have no system yet.
const { list, saveKey } = WEIGHTS
export const COIN = '<svg viewBox="0 0 24 24"><path d="M12 2 21 7v10l-9 5-9-5V7Z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="#fff" stroke-width="2.6"/></svg>'
const CHECK = '<svg viewBox="0 0 24 24"><path d="M3 13 9.5 20 22 5" fill="none" stroke="#15151b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 13 9.5 20 22 5" fill="none" stroke="#35e04a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const PAD = { x: 1.35, z: 0.95 } // half size of the pad's trigger

function load() {
  const save = { owned: [list[0].id], equipped: list[0].id }
  try {
    Object.assign(save, saves.load(saveKey))
  } catch {
    // No storage, or a bad save: start from the default.
  }
  return save
}

const el = (parent, className, html = '') => {
  const e = document.createElement('div')
  e.className = className
  e.innerHTML = html
  parent.append(e)
  return e
}

// hud: the lobby HUD (spend, comingSoon). bases: the plots. run: the climb run.
export function createWeightShop({ hud, bases, run, camera }) {
  const save = load()
  const store = () => {
    try {
      saves.store(saveKey, save)
    } catch {
      // Storage blocked: the weights last this session.
    }
  }
  const equipped = () => list.find((w) => w.id === save.equipped) ?? list[0]

  const win = createWindow({ title: 'Treadmill Shop', className: 'ws-window', onOpen: opened })
  const rail = el(win.body, 'ws-rail')
  rail.addEventListener('wheel', (e) => {
    rail.scrollLeft += e.deltaY
  }, { passive: true })

  const cards = new Map()
  for (const w of list) {
    const card = el(rail, 'ws-card')
    const art = document.createElement('img')
    art.className = 'ws-art'
    art.alt = ''
    card.append(art)
    el(card, 'ws-name uiw-text').textContent = w.name
    const rarity = el(card, 'ws-rarity uiw-text')
    rarity.textContent = w.rarity
    rarity.style.color = w.color
    el(card, 'ws-gain uiw-text', `<b>+${formatCash(w.strength)}</b> Strength <i>/s</i>`)
    cards.set(w.id, { card, art, row: el(card, 'ws-row') })
  }

  const button = (parent, className, html, fn) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `ws-btn uiw-text ${className}`
    b.innerHTML = html
    b.addEventListener('click', () => fn(b))
    parent.append(b)
  }

  function fill(w) {
    const { row } = cards.get(w.id)
    row.textContent = ''
    if (w.id === save.equipped) {
      el(row, 'ws-equipped uiw-text', `${CHECK}<span>Equipped!</span>`)
    } else if (save.owned.includes(w.id)) {
      button(row, 'ws-equip', 'Equip', () => equip(w))
    } else {
      button(row, 'ws-cash', `${formatCash(w.cash)}$`, (b) => buy(w, b))
      button(row, 'ws-coin', `${COIN}<span>${w.coin}</span>`, () => hud.comingSoon('Robux'))
    }
  }

  // What the world shows of the choice: the weight on the pad, its gain, the next price.
  function refresh() {
    list.forEach(fill)
    const next = list.find((w) => !save.owned.includes(w.id))
    bases.setEquipped({ geometry: weightGeometry(equipped().id), gain: `+${formatCash(equipped().strength)} STRENGTH`, cost: next ? `$${formatCash(next.cash)}` : 'MAX' })
  }

  function equip(w) {
    save.equipped = w.id
    store()
    refresh()
  }

  function buy(w, b) {
    if (!hud.spend(w.cash)) {
      b.classList.remove('ws-short')
      void b.offsetWidth
      b.classList.add('ws-short')
      return
    }
    save.owned.push(w.id)
    equip(w)
  }

  function opened() {
    renderWeights((id, url) => (cards.get(id).art.src = url))
    // Comes up on the card after the equipped one, where the next upgrade is.
    requestAnimationFrame(() => {
      const { card } = cards.get(equipped().id)
      rail.scrollLeft = card.offsetLeft - rail.offsetLeft - 12
    })
  }

  refresh()

  return {
    window: win,
    equipped,
    // Once a frame: standing on the pad offers the shop, opened by holding E.
    update() {
      const { x, z } = bases.upgrades
      const on = Math.abs(player.position.x - x) < PAD.x && Math.abs(player.position.z - z) < PAD.z
      const pt = on && player.grounded && !player.drive && !run.busy() ? screenPoint(camera, x, 2.2, z) : null
      hud.prompt(pt && { ...pt, text: 'Shop', hold: true, act: () => win.open() }, 'weights')
    },
  }
}
