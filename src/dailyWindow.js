import './dailyWindow.css'
import { DAILY } from './config.js'
import { petInfo } from './baseFarm.js'
import { CASH } from './indexWindow.js'
import * as net from './net.js'
import { renderArt } from './petArt.js'
import * as saves from './saves.js'
import { createWindow } from './uiWindow.js'

// The Daily Rewards window, off the calendar button: one reward a day, day 1 to 7, then it starts
// over. The first unlocked, unclaimed card is the one to press; the others wait. The calendar runs
// on the server's UTC clock (net.js daily), so a changed device clock unlocks nothing; the paw
// coins won are saved (saves.js). Measured off the reference (dailyWindow.css).
const PAW = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="#5a2a9a" stroke="#15151b" stroke-width="4"/><circle cx="32" cy="32" r="23" fill="#7b3fc8"/><g fill="#8a4a1e" stroke="#2a1408" stroke-width="2.4"><ellipse cx="32" cy="38" rx="11" ry="9"/><ellipse cx="17" cy="28" rx="4.6" ry="6"/><ellipse cx="27" cy="19" rx="4.6" ry="6"/><ellipse cx="38" cy="19" rx="4.6" ry="6"/><ellipse cx="48" cy="28" rx="4.6" ry="6"/></g></svg>`
const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 13 9 21 23 4" fill="none" stroke="#15151b" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 13 9 21 23 4" fill="none" stroke="#2ee04a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const two = (n) => String(n).padStart(2, '0')

function load() {
  return { paws: 0, ...saves.load(DAILY.saveKey) } // paw coins won; the days themselves are the server's
}

// hud: the lobby HUD (rate, addCash, toast, setDailyReady). farm: the plot, which takes the pets.
export function createDailyWindow({ hud, farm }) {
  const state = load()
  const store = () => saves.store(DAILY.saveKey, state)
  const win = createWindow({ title: 'Daily Rewards!', className: 'dw-window', onOpen: opened })
  const timer = document.createElement('span')
  timer.className = 'dw-timer uiw-text'
  win.head.querySelector('h2').after(timer)

  const grid = document.createElement('div')
  grid.className = 'dw-grid'
  win.body.append(grid)

  const cells = DAILY.days.map((day, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `dw-cell${i === DAILY.days.length - 1 ? ' dw-last' : ''}`
    const name = day.pet ? petInfo(day.pet).name : day.label ?? `+${day.paw}`
    const art = day.pet ? '<img alt="" draggable="false">' : day.paw ? PAW : CASH
    b.innerHTML = `<span class="dw-day uiw-text">Day ${i + 1}</span><span class="dw-art">${art}</span>${day.op ? '<span class="dw-op uiw-text">OP!</span>' : ''}<span class="dw-name uiw-text${day.pet ? ' dw-pet' : ''}"></span><span class="dw-check">${CHECK}</span>`
    b.querySelector('.dw-name').textContent = name
    grid.append(b)
    b.addEventListener('click', () => claim(i))
    return { day, b, img: b.querySelector('img') }
  })

  // The calendar is the server's: one more day unlocks each UTC day, and a day is claimed (and
  // paid) only once the server has stored the claim.
  let view = net.daily()
  net.onDaily((next) => {
    view = next
    refresh()
  })
  const done = (i) => !!view?.claimed.includes(i)
  // The day to press: the first unlocked one not yet claimed.
  const next = () => (view ? cells.findIndex((_, i) => i < view.unlocked && !done(i)) : -1)

  let claiming = false
  async function claim(i) {
    if (claiming) return
    if (!view) return hud.toast('Connect to the server to claim!')
    if (i !== next()) return
    claiming = true
    const ok = await net.claimDaily(i)
    claiming = false
    if (!ok) return hud.toast('Could not claim. Try again!')
    const { day } = cells[i]
    if (day.pet) farm.give(day.pet)
    else if (day.cash) hud.addCash(day.cash * hud.rate())
    else {
      state.paws += day.paw
      store()
      hud.toast(`+${day.paw} Paw!`)
    }
  }

  function opened() {
    refresh()
    renderArt((id, art) => {
      for (const c of cells) if (c.day.pet === id) c.img.src = art.color
    })
  }

  let asked = 0 // the day the server was last asked to roll
  function refresh() {
    const ready = next() >= 0
    hud.setDailyReady(ready)
    if (!win.isOpen()) return
    cells.forEach((c, i) => {
      c.b.classList.toggle('done', done(i))
      c.b.classList.toggle('on', i === next())
    })
    if (!view || ready) return void (timer.textContent = '')
    const left = Math.ceil((view.nextAt + view.offset - Date.now()) / 1000)
    if (left <= 0) {
      // Midnight passed while the window was open: the server unlocks the new day.
      if (asked !== view.nextAt) {
        asked = view.nextAt
        net.refreshDaily()
      }
      timer.textContent = ''
      return
    }
    timer.textContent = `Next in ${two(Math.floor(left / 3600))}:${two(Math.floor(left / 60) % 60)}:${two(left % 60)}`
  }

  refresh()
  let shown = -1
  return {
    ...win,
    // The timer moves a whole second at a time.
    update() {
      const second = Math.floor(Date.now() / 1000)
      if (second === shown) return
      shown = second
      refresh()
    },
  }
}
