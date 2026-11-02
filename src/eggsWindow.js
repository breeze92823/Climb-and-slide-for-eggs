import './petsWindow.css'
import './eggsWindow.css'
import { FARM, INDEX } from './config.js'
import { renderArt } from './petArt.js'
import { createWindow } from './uiWindow.js'
import { COIN } from './weightShop.js'

// The Growing Eggs window, off the Eggs button: the eggs placed on the plot, each with CLAIM!,
// which hatches it (there is no growing time yet, so every egg is READY). The frame is the Pets
// window's (petsWindow.css), the rest is eggsWindow.css. The state is in baseFarm.js.
const eggOf = (id) => INDEX.eggs.find((e) => e.id === id)

// hud: the lobby HUD (comingSoon). farm: the plot.
export function createEggsWindow({ hud, farm }) {
  const art = new Map() // egg id -> picture
  const win = createWindow({ title: 'Growing Eggs', className: 'pw-window ge-window', onOpen: opened })
  const count = document.createElement('span')
  count.className = 'ix-count'
  win.head.querySelector('h2').after(count)

  const list = document.createElement('div')
  list.className = 'pw-list'
  win.body.append(list)

  function row({ egg, tier, hatching }) {
    const r = document.createElement('div')
    r.className = 'pw-row ge-row'
    r.dataset.egg = tier.egg
    r.innerHTML = `<img class="pw-thumb" alt="" draggable="false"><div class="pw-text"><div class="pw-name uiw-text"></div><div class="ge-bar uiw-text">READY</div></div>`
    r.querySelector('.pw-name').textContent = eggOf(tier.egg).name
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'pw-toggle on'
    b.innerHTML = '<span class="uiw-text">CLAIM!</span>'
    if (hatching) b.disabled = true
    b.addEventListener('click', () => farm.claimEgg(egg))
    r.append(b)
    paint(r)
    return r
  }

  function auto() {
    const r = document.createElement('div')
    r.className = 'ge-auto'
    r.innerHTML = `<div class="ge-auto-egg"></div><div class="ge-auto-name uiw-text">AUTO HATCH EGGS</div><button type="button" class="ge-auto-buy"><span class="uiw-text">${COIN}${FARM.autoHatchCoin}</span></button>`
    r.querySelector('button').addEventListener('click', () => hud.comingSoon('Auto Hatch Eggs'))
    return r
  }

  function paint(r) {
    const src = art.get(r.dataset.egg)
    if (src) r.querySelector('img').src = src
  }

  function refresh() {
    if (!win.isOpen()) return
    const eggs = farm.growing()
    count.textContent = count.dataset.text = `(${eggs.length}/${FARM.maxEggs})`
    const scroll = list.scrollTop
    list.replaceChildren(...eggs.map(row), auto())
    list.scrollTop = scroll
  }

  function opened() {
    refresh()
    renderArt((id, a) => {
      art.set(id, a.color)
      for (const r of list.querySelectorAll(`[data-egg="${id}"]`)) paint(r)
    })
  }

  farm.onChange(refresh)
  return win
}
