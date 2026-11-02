import './petsWindow.css'
import { petInfo } from './baseFarm.js'
import { renderArt } from './petArt.js'
import { createWindow } from './uiWindow.js'

// The Pets window, off the Pets button: every pet the player owns, active ones first. Only active
// pets wander the plot and earn; the Upgrade Base sign buys more slots. Measured off the reference
// (petsWindow.css). The state is in baseFarm.js.
const money = (n) => `$${n.toLocaleString('en-US')}/s`

// hud: the lobby HUD (toast). farm: the plot.
export function createPetsWindow({ hud, farm }) {
  const art = new Map() // pet id -> picture
  const win = createWindow({ title: 'Pets Active', className: 'pw-window', onOpen: opened })
  const count = document.createElement('span')
  count.className = 'ix-count'
  win.head.querySelector('h2').after(count)

  const list = document.createElement('div')
  list.className = 'pw-list'
  win.body.append(list)

  const best = document.createElement('button')
  best.type = 'button'
  best.className = 'pw-best'
  best.innerHTML = '<span class="uiw-text">EQUIP BEST</span>'
  best.addEventListener('click', farm.equipBest)
  win.stack.append(best)

  function row(entry) {
    const { name, cash, tier } = petInfo(entry.id)
    const r = document.createElement('div')
    r.className = 'pw-row'
    r.innerHTML = `<div class="pw-tile"></div><img class="pw-thumb" alt="" draggable="false"><div class="pw-text"><div class="pw-name uiw-text"></div><div class="pw-cash uiw-text"></div></div>`
    r.querySelector('.pw-name').textContent = name
    r.querySelector('.pw-cash').textContent = money(cash)
    r.style.setProperty('--pw-tier', tier.color)
    r.dataset.pet = entry.id

    const b = document.createElement('button')
    b.type = 'button'
    b.className = `pw-toggle ${entry.on ? 'off' : 'on'}`
    b.innerHTML = `<span class="uiw-text">${entry.on ? 'UNEQUIP' : 'EQUIP'}</span>`
    b.addEventListener('click', () => {
      if (!farm.setActive(entry, !entry.on)) hud.toast('Pets full! Upgrade your base for more')
    })
    r.append(b)
    paint(r)
    return r
  }

  function paint(r) {
    const src = art.get(r.dataset.pet)
    if (!src) return
    r.querySelector('.pw-thumb').src = src
    r.querySelector('.pw-tile').style.backgroundImage = `url(${src})`
  }

  function refresh() {
    if (!win.isOpen()) return
    const text = `(${farm.activeCount()}/${farm.slots()})`
    count.textContent = count.dataset.text = text
    const scroll = list.scrollTop
    const pets = farm.list()
    list.replaceChildren(...pets.map(row))
    if (!pets.length) list.innerHTML = '<div class="lh-soon uiw-text">No pets yet. Hatch an egg!</div>'
    list.scrollTop = scroll
  }

  function opened() {
    // isOpen is already true here.
    refresh()
    renderArt((id, a) => {
      art.set(id, a.color)
      for (const r of list.querySelectorAll(`[data-pet="${id}"]`)) paint(r)
    })
  }

  farm.onChange(refresh)

  return win
}
