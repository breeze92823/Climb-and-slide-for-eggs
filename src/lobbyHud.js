// The lobby's HUD (styles in lobbyHud.css), drawn off the reference screenshots at 1920x990.
// Base, Play and Buy travel, Index and the backpack open their windows, cash earns the player's
// base rate. main.js hands it the windows that need the HUD themselves (setWindows). What has no
// system behind it yet opens a Coming Soon window, so no button is dead.
// All of it steps aside on a climb (body.run-active), .
import './lobbyHud.css'
import { BASES, FARM, LOBBY_HUD, STANDS } from './config.js'
import { createWindow } from './uiWindow.js'
import { COIN } from './coinIcon.js'
import { onCoins } from './coins.js'
import * as net from './net.js'
import * as bloxity from './bloxity.js'
import * as saves from './saves.js'

const ICONS = {
  base: '<svg viewBox="0 0 64 64"><path d="M6 32 32 8l26 24H48v24H16V32Z" fill="#f2c14e" stroke="#2a1a0a" stroke-width="4" stroke-linejoin="round"/><rect x="26" y="38" width="12" height="18" fill="#a65a2a" stroke="#2a1a0a" stroke-width="3"/></svg>',
  ladder: '<svg viewBox="0 0 32 64"><rect x="3" y="2" width="26" height="60" fill="#f6f4ee" stroke="#2c2c34" stroke-width="3"/><path d="M10 4v56M22 4v56M10 14h12M10 28h12M10 42h12M10 14l12 14M22 14 10 28M10 42l12 12M22 42 10 54" fill="none" stroke="#3a3a44" stroke-width="2.6"/></svg>',
  pets: '<svg viewBox="0 0 96 96"><path d="M14 18c-8 4-10 28 2 34 3-8 5-16 12-22Z" fill="#a4501a" stroke="#22120a" stroke-width="4"/><path d="M82 18c8 4 10 28-2 34-3-8-5-16-12-22Z" fill="#a4501a" stroke="#22120a" stroke-width="4"/><path d="M18 46c0-20 14-30 30-30s30 10 30 30-13 36-30 36-30-16-30-36Z" fill="#f49a32" stroke="#22120a" stroke-width="4"/><path d="M30 60c0-10 8-14 18-14s18 4 18 14-8 18-18 18-18-8-18-18Z" fill="#fff0da"/><circle cx="35" cy="42" r="6" fill="#22120a"/><circle cx="61" cy="42" r="6" fill="#22120a"/><path d="M41 54h14l-7 7Z" fill="#22120a"/><path d="M42 66c4 5 8 5 12 0l-6 12Z" fill="#ff6d7e"/></svg>',
  eggs: '<svg viewBox="0 0 96 96"><path d="M12 30 48 12l36 18v42L48 90 12 72Z" fill="#e8913a" stroke="#3a1e0a" stroke-width="4" stroke-linejoin="round"/><path d="M12 30 48 48l36-18M48 48v42" fill="none" stroke="#3a1e0a" stroke-width="4"/><path d="M60 54c5-5 13-7 13 2 0 9-6 16-13 18Z" fill="#fff4e4"/><path d="M12 30 48 12l36 18-36 18Z" fill="#f5ab58" stroke="#3a1e0a" stroke-width="4" stroke-linejoin="round"/></svg>',
  index: '<svg viewBox="0 0 96 96"><path d="M16 22 66 8l14 12v62L30 92 16 80Z" fill="#1db6c9" stroke="#0c3442" stroke-width="4" stroke-linejoin="round"/><path d="M16 22 30 34v58" fill="none" stroke="#0c3442" stroke-width="4"/><path d="M30 34 80 20" stroke="#0c3442" stroke-width="4"/><path d="M42 40l26-7v9l-26 7ZM42 56l18-5v9l-18 5Z" fill="#ffb238"/></svg>',
  shop: '<svg viewBox="0 0 96 96"><path d="M14 40h68l-8 44H22Z" fill="#d8391f" stroke="#3a0e08" stroke-width="4" stroke-linejoin="round"/><path d="M26 42 40 12M70 42 56 12" fill="none" stroke="#3a0e08" stroke-width="6" stroke-linecap="round"/><circle cx="34" cy="34" r="11" fill="#3fbcf0" stroke="#0c3442" stroke-width="3"/><path d="M46 36l12-14 12 14Z" fill="#35d15a" stroke="#0c3a18" stroke-width="3"/><circle cx="60" cy="38" r="9" fill="#ffd23a" stroke="#6a4a08" stroke-width="3"/><path d="M28 54v22M44 54v22M60 54v22M72 54l-2 22" stroke="#7a1a10" stroke-width="3"/></svg>',
  rebirth: '<svg viewBox="0 0 96 96"><path d="M16 48a32 32 0 0 1 56-22l8-8v28H52l10-10a18 18 0 0 0-31 12Z" fill="#35d15a" stroke="#123a18" stroke-width="4" stroke-linejoin="round"/><path d="M80 48a32 32 0 0 1-56 22l-8 8V50h28L34 60a18 18 0 0 0 31-12Z" fill="#f05fc0" stroke="#4a1038" stroke-width="4" stroke-linejoin="round"/></svg>',
  gift: '<svg viewBox="0 0 96 96"><rect x="14" y="42" width="68" height="44" fill="#ff5c52" stroke="#4a100c" stroke-width="4"/><rect x="8" y="30" width="80" height="16" fill="#ff7a6e" stroke="#4a100c" stroke-width="4"/><path d="M40 30h16v56H40Z" fill="#fff0c8" stroke="#4a100c" stroke-width="3"/><path d="M48 30C26 30 22 8 36 8c10 0 12 14 12 22 0-8 2-22 12-22 14 0 10 22-12 22Z" fill="#ffe05a" stroke="#4a100c" stroke-width="4" stroke-linejoin="round"/></svg>',
  pass: '<svg viewBox="0 0 120 80"><path d="M6 22 104 6l10 14-4 18 6 22-98 14-8-14 6-18Z" fill="#ffbe2e" stroke="#4a2a06" stroke-width="4" stroke-linejoin="round"/><path d="M46 22l30 30M76 22 46 52" stroke="#a8600e" stroke-width="7" stroke-linecap="round"/><circle cx="61" cy="37" r="6" fill="#a8600e"/></svg>',
  perk: '<svg viewBox="0 0 64 64"><path d="M32 6 54 18v28L32 58 10 46V18Z" fill="#141420" stroke="#ffc21f" stroke-width="5" stroke-linejoin="round"/><path d="M24 44V20h11a8 8 0 0 1 0 16H24" fill="none" stroke="#ffc21f" stroke-width="5"/></svg>',
  friends: '<svg viewBox="0 0 64 64"><rect x="8" y="16" width="36" height="36" rx="8" fill="#ffd93a" stroke="#3a2a06" stroke-width="4"/><circle cx="20" cy="31" r="3" fill="#3a2a06"/><circle cx="33" cy="31" r="3" fill="#3a2a06"/><path d="M46 12v14M39 19h14" stroke="#35d15a" stroke-width="6" stroke-linecap="round"/></svg>',
  calendar: '<svg viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="44" rx="6" fill="#fff" stroke="#2a2a34" stroke-width="4"/><path d="M8 26V18a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v8Z" fill="#e8363c" stroke="#2a2a34" stroke-width="4"/><text x="32" y="50" text-anchor="middle" font-size="24" font-weight="700" fill="#2a2a34">17</text></svg>',
  joystick: '<svg viewBox="0 0 64 64"><path d="M6 50 44 38l14 8-38 14Z" fill="#6d7ff0" stroke="#1c2050" stroke-width="4" stroke-linejoin="round"/><path d="M30 44 44 16" stroke="#e8e8f0" stroke-width="6" stroke-linecap="round"/><circle cx="46" cy="13" r="8" fill="#e8363c" stroke="#4a100c" stroke-width="3"/></svg>',
}

const el = (parent, className, html = '') => {
  const e = document.createElement('div')
  e.className = className
  e.innerHTML = html
  parent.append(e)
  return e
}

export function formatCash(n) {
  const units = [[1e21, 'Sx'], [1e18, 'Qi'], [1e15, 'Qa'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]
  for (const [size, unit] of units) {
    if (n >= size) return `${(Math.floor((n / size) * 10) / 10).toString()}${unit}`
  }
  return Math.floor(n).toString()
}

function loadCash() {
  const start = { cash: import.meta.env.DEV ? LOBBY_HUD.devCash : 0, at: 0 }
  try {
    return { ...start, ...saves.load(LOBBY_HUD.saveKey) }
  } catch {
    return start // No storage, or a bad save.
  }
}
function storeCash(cash) {
  try {
    saves.store(LOBBY_HUD.saveKey, { cash, at: Date.now() })
  } catch {
    // Storage blocked: the cash lasts this session.
  }
}

// actions: travel(spot) with spot = { x, z, facing }, run (the climb run: eggs(), slot(), select(i)),
// indexWindow.
export function createLobbyHud({ travel, run, indexWindow }) {
  const root = el(document.body, 'lh-root')

  const button = (parent, className, html, fn) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = className
    b.innerHTML = html
    b.addEventListener('click', fn)
    parent.append(b)
    return b
  }
  const card = (parent, title, icon, fn, extra = '') => button(parent, `lh-card lh-${title.toLowerCase().replace(/\W/g, '')}`, `<span class="lh-card-art">${ICONS[icon]}</span><span class="lh-card-word lh-text">${title}</span>${extra}`, fn)

  // --- Coming Soon, and the backpack ---------------------------------------------------------
  const soon = createWindow({ title: 'Coming Soon', className: 'lh-window' })
  const soonText = el(soon.body, 'lh-soon uiw-text')
  const later = (title) => () => {
    soon.head.querySelector('h2').textContent = title
    soonText.textContent = 'Coming soon!'
    soon.open()
  }
  const windows = {} // pets, rebirth, gift, daily, sell, eggs, trails, coins (setWindows)
  const show = (name) => () => windows[name].toggle()

  const backpack = createWindow({ title: 'Backpack', className: 'lh-window', onOpen: () => fillBackpack() })
  const pack = el(backpack.body, 'lh-pack')
  function fillBackpack() {
    pack.textContent = ''
    const eggs = run.eggs()
    if (!eggs.length) el(pack, 'lh-soon uiw-text', 'No eggs yet. Climb the stairs!')
    eggs.forEach(({ tier, name, count }, i) => {
      button(pack, `lh-egg${run.slot() === i + 1 ? ' on' : ''}`, `<span class="lh-egg-shell" style="background:${tier.color}"></span><span class="lh-egg-name uiw-text"></span><span class="lh-egg-tier uiw-text" style="color:${tier.color}">${tier.name}${count > 1 ? ` x${count}` : ''}</span>`, () => {
        run.select(i + 1)
        backpack.close()
      }).querySelector('.lh-egg-name').textContent = name
    })
  }

  // --- Top: travel --------------------------------------------------------------------------
  const ownerX = BASES.list[net.seat()].x // the plot the room gave this player
  const nav = el(root, 'lh-nav')
  // Inside the plot the first tab sells instead (setInBase).
  let home = false
  const tab = button(nav, 'lh-tab lh-tab-base', `<span class="lh-tab-word lh-text">Base</span>`, () => {
    if (home) windows.sell.toggle()
    else travel({ x: ownerX, z: BASES.front + 3, facing: 0 })
  })
  const tabWord = tab.querySelector('.lh-tab-word')
  const offline = el(root, 'lh-offline lh-text')
  button(nav, 'lh-tab lh-tab-play', `<span class="lh-tab-rail">${ICONS.ladder}</span><span class="lh-tab-word lh-text">Play</span><span class="lh-tab-rail">${ICONS.ladder}</span>`, () => travel({ x: LOBBY_HUD.play.x, z: LOBBY_HUD.play.z, facing: Math.PI }))
  button(nav, 'lh-tab lh-tab-buy', `<span class="lh-tab-word lh-text">Buy</span>`, () => travel({ x: STANDS.shop.x, z: STANDS.shop.z + 6, facing: Math.PI }))

  // --- Left: Pets, Eggs, income, cash ---------------------------------------------------------
  const left = el(root, 'lh-left')
  const petsCard = card(left, 'Pets', 'pets', show('pets'), '<span class="lh-mark lh-text">!</span>')
  const eggsCard = card(left, 'Eggs', 'eggs', show('eggs'), '<span class="lh-mark lh-text">!</span>')
  const feed = el(root, 'lh-feed')
  const cashRow = el(root, 'lh-cash lh-text', '<span class="lh-cash-art"></span><span class="lh-cash-num"></span>')
  const cashNum = cashRow.querySelector('.lh-cash-num')
  const coinRow = el(root, 'lh-coins lh-text', `${COIN}<span class="lh-coins-num"></span>`)
  const coinNum = coinRow.querySelector('.lh-coins-num')
  button(coinRow, 'lh-coins-add lh-text', '+', show('coins'))
  onCoins((n) => (coinNum.textContent = formatCash(n)))

  // --- Right: offers and buttons ---------------------------------------------------------------
  const grid = el(root, 'lh-grid')
  card(grid, 'Index', 'index', indexWindow.toggle)
  card(grid, 'Shop', 'shop', show('trails'), '<span class="lh-ribbon lh-text">FREE!</span>')
  const rebirthCard = card(grid, 'Rebirth', 'rebirth', show('rebirth'), '<span class="lh-mark lh-text">!</span>')
  const giftCard = card(grid, 'Ready!', 'gift', show('gift'), '<span class="lh-badge lh-text">1</span>')
  const giftWord = giftCard.querySelector('.lh-card-word')
  const giftBadge = giftCard.querySelector('.lh-badge')

  // --- Bottom ---------------------------------------------------------------------------------
  const perks = el(root, 'lh-perks')
  let dailyCard = null
  button(perks, 'lh-perk', ICONS.friends, async () => {
    const link = bloxity.inviteLink()
    if (!link) return toast('Invites are not available here')
    try {
      await navigator.clipboard.writeText(link)
      toast('Invite link copied! Share it with friends')
    } catch {
      window.prompt('Copy this link to invite friends', link)
    }
  })
  dailyCard = button(perks, 'lh-perk', ICONS.calendar, show('daily'))
  button(root, 'lh-backpack lh-text', '<span class="lh-key">[G] </span>Open Backpack', backpack.toggle)
  const toastEl = el(document.body, 'lh-toast lh-text') // over the windows too
  toastEl.addEventListener('animationend', () => toastEl.classList.remove('on'))
  const toast = (text) => {
    toastEl.textContent = text
    toastEl.classList.remove('on')
    void toastEl.offsetWidth // restarts the animation
    toastEl.classList.add('on')
  }
  const promptEl = button(root, 'lh-prompt', '<span class="lh-prompt-fill"></span><span class="lh-prompt-key">E</span><span class="lh-prompt-word"></span><span class="lh-prompt-hint">Hold</span>', () => {})
  const promptWord = promptEl.querySelector('.lh-prompt-word')
  let promptAction = null
  // Prompts come from several systems (source -> { x, y, text, hold?, act? }); the first set one
  // shows. A tap prompt fires on press; a hold prompt (hold: true) fills over LOBBY_HUD.holdTime
  // while E or the prompt is held, and fires once. It needs a release before it can fire again.
  const prompts = new Map()
  let current = null
  let currentKey = ''
  let holding = false
  let held = 0
  let spent = false
  const resetHold = () => {
    holding = false
    held = 0
    spent = false
    promptEl.classList.remove('holding')
    promptEl.style.setProperty('--hold', 0)
  }
  function press() {
    if (!current || holding || spent) return
    if (!current.hold) return void (current.act ?? promptAction)?.()
    holding = true
    held = 0
    promptEl.classList.add('holding')
  }
  function release() {
    resetHold()
  }
  function showPrompt() {
    let next = null
    let source = ''
    for (const [s, p] of prompts) {
      if (p) {
        next = p
        source = s
        break
      }
    }
    const key = next ? `${source}:${next.text}` : ''
    if (key !== currentKey) resetHold()
    current = next
    currentKey = key
    promptEl.classList.toggle('on', !!next)
    promptEl.classList.toggle('hold', !!next?.hold)
    if (!next) return
    promptEl.style.left = `${next.x * 100}%`
    promptEl.style.top = `${next.y * 100}%`
    if (promptWord.textContent !== next.text) promptWord.textContent = next.text
  }
  // Touch and mouse: pressing the prompt is the same as pressing E.
  promptEl.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    press()
  })
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) promptEl.addEventListener(type, release)

  // --- Cash -----------------------------------------------------------------------------------
  const saved = loadCash()
  let cash = saved.cash
  let rate = 0
  let animalRate = 0
  let wait = LOBBY_HUD.incomeEvery
  let saveWait = LOBBY_HUD.saveEvery
  cashNum.textContent = `${formatCash(cash)}$`

  function earn() {
    const gain = rate * LOBBY_HUD.incomeEvery
    cash += gain
    cashNum.textContent = `${formatCash(cash)}$`
    const line = el(feed, 'lh-feed-line lh-text', `+${formatCash(gain)}$`)
    line.addEventListener('animationend', () => line.remove())
  }

  // The toolbar spans the top of a narrow phone: the travel tabs go under it then.
  const TOOLBAR_GAP = 8
  const fitNav = (areas) => {
    const bar = areas.find((a) => a.id === 'toolbar')
    nav.style.removeProperty('--lh-nav-top')
    if (!bar?.width || !bar.height) return
    const r = nav.getBoundingClientRect()
    if (r.left < bar.left + bar.width && bar.left < r.right) nav.style.setProperty('--lh-nav-top', `${bar.top + bar.height + TOOLBAR_GAP}px`)
  }

  const offlineLine = () => {
    offline.innerHTML = `Your animals earn <b>$${formatCash(animalRate * FARM.offlineCap)}</b> offline! 🤑`
  }

  return {
    backpack,
    fitNav,
    comingSoon: (title) => later(title)(),
    setWindows: (list) => Object.assign(windows, list),
    cash: () => cash,
    rate: () => rate,
    addCash(amount) {
      cash += amount
      cashNum.textContent = `${formatCash(cash)}$`
      storeCash(cash)
    },
    // Takes `amount` of the cash; false if there isn't that much.
    spend(amount) {
      if (cash < amount) return false
      cash -= amount
      cashNum.textContent = `${formatCash(cash)}$`
      storeCash(cash)
      return true
    },
    // Total $/s and the part of it from pets (the part that earns while away).
    setRate(total, animals) {
      rate = total
      animalRate = animals
      offlineLine()
      offline.classList.toggle('on', home && animals > 0)
    },
    // Pays the pets for the time since the last save. Once, after the first setRate.
    payOffline() {
      if (!saved.at) return
      cash += animalRate * Math.min((Date.now() - saved.at) / 1000, FARM.offlineCap)
      cashNum.textContent = `${formatCash(cash)}$`
    },
    setInBase(on) {
      if (on === home) return
      home = on
      tabWord.textContent = on ? 'Sell' : 'Base'
      tab.classList.toggle('lh-tab-sell', on)
      offline.classList.toggle('on', on && animalRate > 0)
    },
    setEggsReady(on) {
      eggsCard.classList.toggle('ready', on)
    },
    setDailyReady(on) {
      dailyCard.classList.toggle('ready', on)
    },
    setPetsReady(on) {
      petsCard.classList.toggle('ready', on)
    },
    setRebirthReady(on) {
      rebirthCard.classList.toggle('ready', on)
    },
    // The gift button: how many rewards wait, and its word (Ready! or the next timer).
    setGift(count, word) {
      giftBadge.textContent = count
      giftBadge.style.display = count ? '' : 'none'
      giftWord.textContent = word
    },
    toast,
    onPrompt(fn) {
      promptAction = fn
    },
    // The world prompt of one source: { x, y (0..1 of the screen), text, hold?, act? }, or null.
    prompt(p, source = 'world') {
      prompts.set(source, p)
      showPrompt()
    },
    // E down / up (main.js); the prompt itself does the same for mouse and touch.
    press,
    release,
    update(dt) {
      if (holding && current) {
        held += dt
        promptEl.style.setProperty('--hold', Math.min(held / LOBBY_HUD.holdTime, 1))
        if (held >= LOBBY_HUD.holdTime) {
          holding = false
          held = 0
          spent = true
          promptEl.classList.remove('holding')
          promptEl.style.setProperty('--hold', 0)
          ;(current.act ?? promptAction)?.()
        }
      }
      wait -= dt
      if (wait <= 0) {
        wait += LOBBY_HUD.incomeEvery
        earn()
      }
      saveWait -= dt
      if (saveWait <= 0) {
        saveWait = LOBBY_HUD.saveEvery
        storeCash(cash)
      }
    },
  }
}
