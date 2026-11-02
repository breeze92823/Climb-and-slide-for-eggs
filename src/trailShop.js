import './weightShop.css'
import './trailShop.css'
import { TRAILS } from './config.js'
import { createTrailFx } from './trailFx.js'
import { trailPicture } from './trailArt.js'
import { formatCash } from './lobbyHud.js'
import { sfx } from './audio/index.js'
import { createWindow } from './uiWindow.js'
import { COIN } from './weightShop.js'
import { spendCoins } from './coins.js'
import * as saves from './saves.js'

// The Trail Shop, off the Shop button. Each trail multiplies the strength the player gains (a run's
// and every rep's); one is equipped and drawn behind them (trailFx.js). Same rail of cards as the
// Treadmill Shop (weightShop.css). Saved through saves.js. Robux prices have no system yet.
const { list, saveKey } = TRAILS
const CHECK = '<svg viewBox="0 0 24 24"><path d="M3 13 9.5 20 22 5" fill="none" stroke="#15151b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 13 9.5 20 22 5" fill="none" stroke="#35e04a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

function load() {
  const save = { owned: [], equipped: '' }
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

// hud: the lobby HUD (spend, comingSoon). scene: where the trail is drawn.
export function createTrailShop({ hud, scene }) {
  const save = load()
  const fx = createTrailFx(scene)
  const store = () => {
    try {
      saves.store(saveKey, save)
    } catch {
      // Storage blocked: the trails last this session.
    }
  }
  const equipped = () => list.find((t) => t.id === save.equipped) ?? null

  const win = createWindow({ title: 'Trail Shop', className: 'ws-window ts-window', onOpen: opened })
  const rail = el(win.body, 'ws-rail')
  rail.addEventListener('wheel', (e) => {
    rail.scrollLeft += e.deltaY
  }, { passive: true })

  const cards = new Map()
  for (const t of list) {
    const card = el(rail, 'ws-card')
    const art = document.createElement('img')
    art.className = 'ws-art'
    art.alt = ''
    card.append(art)
    el(card, 'ws-name uiw-text').textContent = t.name
    const rarity = el(card, 'ws-rarity uiw-text')
    rarity.textContent = t.rarity
    rarity.style.color = t.rarityColor
    el(card, 'ws-gain uiw-text', `<b>x${t.multi.toFixed(2)}</b> Strength`)
    cards.set(t.id, { card, art, row: el(card, 'ws-row') })
  }

  const button = (parent, className, html, fn) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `ws-btn uiw-text ${className}`
    b.innerHTML = html
    b.addEventListener('click', () => fn(b))
    parent.append(b)
  }

  function fill(t) {
    const { row } = cards.get(t.id)
    row.textContent = ''
    if (t.id === save.equipped) {
      // Tapping the equipped one takes it off.
      el(row, 'ws-equipped uiw-text ts-off', `${CHECK}<span>Equipped!</span>`).addEventListener('click', () => equip(null))
    } else if (save.owned.includes(t.id)) {
      button(row, 'ws-equip', 'Equip', () => equip(t))
    } else {
      button(row, 'ws-cash', `${formatCash(t.cash)}$`, (b) => buy(t, b))
      button(row, 'ws-coin', `${COIN}<span>${t.coin}</span>`, (b) => buyCoins(t, b))
    }
  }

  function refresh() {
    list.forEach(fill)
    fx.set(equipped())
  }

  function equip(t) {
    save.equipped = t ? t.id : ''
    if (t) sfx.equip()
    else sfx.pop(false)
    store()
    refresh()
  }

  const short = (b) => {
    b.classList.remove('ws-short')
    void b.offsetWidth
    b.classList.add('ws-short')
  }

  function buyCoins(t, b) {
    if (!spendCoins(t.coin)) return void short(b)
    save.owned.push(t.id)
    equip(t)
  }

  function buy(t, b) {
    if (!hud.spend(t.cash)) {
      b.classList.remove('ws-short')
      void b.offsetWidth
      b.classList.add('ws-short')
      return
    }
    save.owned.push(t.id)
    equip(t)
  }

  function opened() {
    for (const t of list) cards.get(t.id).art.src = trailPicture(t.color)
    // Comes up on the first one the player doesn't own.
    requestAnimationFrame(() => {
      const next = list.find((t) => !save.owned.includes(t.id)) ?? list[0]
      const { card } = cards.get(next.id)
      rail.scrollLeft = card.offsetLeft - rail.offsetLeft - 12
    })
  }

  refresh()
  return {
    ...win,
    // The strength multiplier of the equipped trail.
    multi: () => equipped()?.multi ?? 1,
    update: fx.update,
  }
}
