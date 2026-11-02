// The Index window: every pet in every variant tab, one row per egg. Pets not found yet are
// black silhouettes under ???; an egg stays a silhouette until the player has reached it.
// The footer fills towards the next completed egg of the open tab. Layout and colours are in
// indexWindow.css (measured off the reference), collection state in petIndex.js.
import './indexWindow.css'
import { INDEX } from './config.js'
import { createWindow } from './uiWindow.js'
import { eggProgress, foundCount, isEggRevealed, isPetFound, onIndexChange, totalCount } from './petIndex.js'
import { renderArt } from './petArt.js'

const ARROW = `<svg viewBox="0 0 17 17" shape-rendering="crispEdges" aria-hidden="true">
  <path fill="#0a0d0c" d="M0 5H9V0H11V1H12V2H13V3H14V4H15V5H16V6H17V11H16V12H15V13H14V14H13V15H12V16H11V17H9V12H0Z"/>
  <path fill="#12cf68" d="M1 6H10V2H11V3H12V4H13V5H14V6H15V7H16V10H15V11H14V12H13V13H12V14H11V15H10V11H1Z"/>
  <path fill="#10a957" d="M1 10H10V11H1ZM10 13H12V14H11V15H10ZM12 12H13V13H12ZM13 11H14V12H13ZM14 10H15V11H14Z"/>
</svg>`

export const CASH = `<svg viewBox="0 0 48 34" aria-hidden="true">
  <path fill="#4f8a12" d="M3 18 31 4l15 11v7L19 33 3 25z"/>
  <path fill="#94d62c" d="M2 16 30 2l16 11-27 14z"/>
  <path fill="#f4e36c" d="m13 10 16 11-5 3L8 13z"/>
  <path fill="#6fae1c" d="m19 27 27-14v3L19 30z"/>
</svg>`

const money = (n) => `$${n.toLocaleString('en-US')}/s`

export function createIndexWindow() {
  let tab = INDEX.tabs[0].id
  let lastPointer = 'mouse'

  const win = createWindow({ title: 'Index', className: 'ix-overlay', onOpen: open, onClose: hideTip })
  const { body, head, stack, overlay } = win

  const count = document.createElement('span')
  count.className = 'ix-count'
  head.querySelector('h2').after(count)

  // --- Rows ---------------------------------------------------------------------------
  const list = document.createElement('div')
  list.className = 'ix-list'
  body.append(list)

  const pictures = new Map() // art id -> [{ img, lit() }], filled as the art renders
  const artFor = new Map()
  function picture(id, lit) {
    const img = document.createElement('img')
    img.alt = ''
    img.draggable = false
    const entry = { img, lit }
    pictures.set(id, [...(pictures.get(id) ?? []), entry])
    return entry
  }
  const paint = (id) => {
    const a = artFor.get(id)
    if (!a) return
    for (const p of pictures.get(id) ?? []) {
      const src = p.lit() ? a.color : a.shadow
      if (p.img.getAttribute('src') !== src) p.img.src = src
    }
  }

  const rows = INDEX.eggs.map((egg) => {
    const row = document.createElement('div')
    row.className = `ix-row tier-${egg.tier}`

    const eggBox = document.createElement('div')
    eggBox.className = 'ix-egg'
    const eggPic = picture(egg.id, () => isEggRevealed(egg.id))
    const eggName = document.createElement('span')
    eggName.className = 'uiw-text'
    eggBox.append(eggPic.img, eggName)

    const arrow = document.createElement('div')
    arrow.className = 'ix-arrow'
    arrow.innerHTML = ARROW

    const cards = egg.pets.map((pet) => {
      const card = document.createElement('div')
      card.className = 'ix-card'
      const pic = picture(pet.id, () => isPetFound(tab, pet.id))
      const bar = document.createElement('div')
      bar.className = 'ix-card-bar'
      const name = document.createElement('span')
      name.className = 'uiw-text'
      bar.append(name)
      card.append(pic.img, bar)
      card.pet = pet
      return { card, name, pet }
    })

    row.append(eggBox, arrow, ...cards.map((c) => c.card))
    list.append(row)
    return { egg, eggName, cards }
  })

  // --- Tabs ---------------------------------------------------------------------------
  const tabs = document.createElement('div')
  tabs.className = 'ix-tabs'
  const tabButtons = INDEX.tabs.map((t) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `ix-tab t-${t.id}`
    b.innerHTML = `<span class="uiw-text">${t.label}</span>`
    if (t.bonus) {
      const tip = document.createElement('span')
      tip.className = 'ix-tab-tip'
      tip.innerHTML = `<i class="uiw-text">+${t.bonus}%<em>$</em></i>`
      b.append(tip)
    }
    b.addEventListener('click', () => {
      tab = t.id
      hideTip()
      refresh()
    })
    return { b, id: t.id }
  })
  tabs.append(...tabButtons.map((t) => t.b))
  stack.append(tabs)

  // --- Footer -------------------------------------------------------------------------
  const foot = document.createElement('div')
  foot.className = 'ix-foot'
  const reward = `+${INDEX.perEggBonus}%`
  foot.innerHTML = `<p class="uiw-text">Gain ${reward} <span class="ix-cash">Cash Multi</span> for each <span class="ix-word">Egg</span> you’ve complete</p>
    <div class="ix-bar"><div class="ix-fill"></div><div class="ix-bar-text">${CASH}<span class="uiw-text">${reward}</span></div></div>`
  stack.append(foot)
  const fill = foot.querySelector('.ix-fill')

  // --- Pet tooltip: follows the mouse; on touch a tap pins it on the card ---------------
  const tip = document.createElement('div')
  tip.className = 'ix-tip'
  tip.hidden = true
  tip.innerHTML = `<div class="ix-tip-name"></div><hr><div class="ix-tip-cash">${CASH}<span></span></div>`
  overlay.append(tip)
  const tipName = tip.querySelector('.ix-tip-name')
  const tipCash = tip.querySelector('.ix-tip-cash span')
  let tipCard = null

  function hideTip() {
    tip.hidden = true
    tipCard = null
  }
  function showTip(card, x, y) {
    if (!isPetFound(tab, card.pet.id)) return hideTip()
    tipCard = card
    tipName.textContent = card.pet.name
    tipCash.textContent = money(card.pet.cash)
    tip.hidden = false
    tip.style.left = `${Math.max(4, Math.min(x, window.innerWidth - tip.offsetWidth - 4))}px`
    tip.style.top = `${Math.max(4, Math.min(y, window.innerHeight - tip.offsetHeight - 4))}px`
  }
  const cardAt = (e) => e.target.closest?.('.ix-card') ?? null

  list.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType
  })
  list.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    const card = cardAt(e)
    if (card) showTip(card, e.clientX, e.clientY)
    else hideTip()
  })
  list.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') hideTip()
  })
  list.addEventListener('click', (e) => {
    if (lastPointer === 'mouse') return
    const card = cardAt(e)
    if (!card || card === tipCard) return hideTip()
    const r = card.getBoundingClientRect()
    showTip(card, r.left + r.width / 2, r.top + r.height / 2)
  })
  list.addEventListener('scroll', hideTip, { passive: true })
  overlay.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' && !cardAt(e)) hideTip()
  })

  // --- State -> screen ------------------------------------------------------------------
  function refresh() {
    count.textContent = count.dataset.text = `(${foundCount()}/${totalCount()})`
    stack.dataset.tab = tab
    for (const t of tabButtons) t.b.classList.toggle('on', t.id === tab)
    for (const r of rows) {
      const seen = isEggRevealed(r.egg.id)
      r.eggName.textContent = seen ? r.egg.name : '???'
      paint(r.egg.id)
      for (const c of r.cards) {
        const known = isPetFound(tab, c.pet.id)
        c.name.textContent = known ? c.pet.name : '???'
        c.card.classList.toggle('known', known)
        paint(c.pet.id)
      }
    }
    fill.style.width = `${eggProgress(tab) * 100}%`
  }

  function open() {
    refresh()
    renderArt((id, a) => {
      artFor.set(id, a)
      paint(id)
    })
  }

  onIndexChange(() => win.isOpen() && refresh())

  return win
}
