import './playtimeWindow.css'
import { ADS, PLAYTIME } from './config.js'
import { petInfo } from './baseFarm.js'
import { CASH } from './indexWindow.js'
import { renderArt } from './petArt.js'
import * as bloxity from './bloxity.js'
import { formatCash } from './lobbyHud.js'
import * as net from './net.js'
import { sfx } from './audio/index.js'
import { createWindow } from './uiWindow.js'
import { COIN } from './weightShop.js'

// The Playtime Rewards window, off the gift button: twelve rewards that come ready as the session
// goes on. Nothing is saved, so leaving resets the timers and the claims (the pets stay). Measured
// off the reference (playtimeWindow.css). Skip All's price has no system yet.
const two = (n) => String(n).padStart(2, '0')
export function clock(s) {
  const left = Math.ceil(s)
  const h = Math.floor(left / 3600)
  const m = Math.floor(left / 60) % 60
  return `${h ? `${two(h)}:` : ''}${two(m)}:${two(left % 60)}`
}

// hud: the lobby HUD (rate, addCash, comingSoon, setGift). farm: the plot, which takes the pets.
export function createPlaytimeWindow({ hud, farm }) {
  const started = Date.now()
  const played = () => (Date.now() - started) / 1000
  const win = createWindow({ title: 'Playtime Rewards', className: 'pt-window', onOpen: opened })

  const grid = document.createElement('div')
  grid.className = 'pt-grid'
  win.body.append(grid)

  const cells = PLAYTIME.rewards.map((reward) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'pt-cell'
    b.innerHTML = `<span class="pt-name uiw-text"></span><span class="pt-art">${reward.pet ? '<img alt="" draggable="false">' : CASH}</span><span class="pt-state uiw-text"></span>`
    b.querySelector('.pt-name').textContent = reward.pet ? petInfo(reward.pet).name : 'Cash'
    grid.append(b)
    const cell = { reward, b, state: b.querySelector('.pt-state'), img: b.querySelector('img'), claimed: false }
    b.addEventListener('click', () => claim(cell))
    return cell
  })

  const foot = document.createElement('div')
  foot.className = 'pt-foot'
  foot.innerHTML = `<p class="pt-warn uiw-text">Leaving Resets Progress!</p><button type="button" class="pt-ad uiw-text" hidden></button><div class="pt-skip"><span class="pt-skip-word uiw-text">Skip All!</span><button type="button" class="pt-skip-btn"><span class="uiw-text">${COIN}${PLAYTIME.coin}</span></button></div>`
  win.body.append(foot)
  foot.querySelector('button').addEventListener('click', () => hud.comingSoon('Skip All'))

  // A rewarded ad (Boxity) pays seconds of the current rate, once the server has checked the ad.
  const { placement, seconds, cooldown } = ADS.rewarded
  const adButton = foot.querySelector('.pt-ad')
  adButton.textContent = `Watch Ad: +${Math.round(seconds / 60)} min Cash`
  let adBusy = false
  let adAt = 0
  adButton.addEventListener('click', async () => {
    if (adBusy || Date.now() - adAt < cooldown * 1000) return hud.toast('Please wait a moment!')
    adBusy = true
    const result = await bloxity.showRewardedAd(placement)
    const paid = result.status === 'completed' && (await net.verifyAd(placement, result.rewardToken))
    adBusy = false
    if (!paid) return void (result.status === 'completed' && hud.toast("Couldn't check the ad!"))
    adAt = Date.now()
    const gain = hud.rate() * seconds
    sfx.gift()
    hud.addCash(gain)
    hud.toast(`+${formatCash(gain)}$`)
  })

  const ready = (cell) => !cell.claimed && played() >= cell.reward.at

  function claim(cell) {
    if (!ready(cell)) return
    cell.claimed = true
    sfx.gift()
    if (cell.reward.pet) farm.give(cell.reward.pet)
    else hud.addCash(cell.reward.cash * hud.rate())
    refresh()
  }

  function opened() {
    adButton.hidden = !(bloxity.adsAvailable() && net.connected())
    refresh()
    renderArt((id, art) => {
      for (const c of cells) if (c.reward.pet === id) c.img.src = art.color
    })
  }

  function refresh() {
    let waiting = 0
    let next = Infinity
    for (const c of cells) {
      const on = ready(c)
      if (on) waiting++
      else if (!c.claimed) next = Math.min(next, c.reward.at)
      if (!win.isOpen()) continue
      const text = c.claimed ? 'Claimed' : on ? 'Claim!' : clock(c.reward.at - played())
      if (c.state.textContent !== text) c.state.textContent = text
      c.b.classList.toggle('on', on)
      c.b.classList.toggle('done', c.claimed)
    }
    hud.setGift(waiting, waiting ? 'Ready!' : next < Infinity ? clock(next - played()) : 'Done!')
  }

  let shown = -1
  return {
    ...win,
    // The timers move a whole second at a time.
    update() {
      const second = Math.floor(played())
      if (second === shown) return
      shown = second
      refresh()
    },
  }
}
