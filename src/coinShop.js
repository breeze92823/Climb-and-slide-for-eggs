import './coinShop.css'
import { COINS } from './config.js'
import { addCoins, onCoins, packPrice } from './coins.js'
import { formatCash } from './lobbyHud.js'
import { createWindow } from './uiWindow.js'
import { COIN } from './coinIcon.js'

// The Coins window: packs of coins bought with cash. Only the amount and the cash price are
// shown, never a rate or a discount; the bigger the pack the cheaper each coin (coins.js).
// hud: the lobby HUD (spend, toast).
export function createCoinShop({ hud }) {
  const win = createWindow({ title: 'Coins', className: 'cs-window' })
  const balance = document.createElement('div')
  balance.className = 'cs-balance uiw-text'
  win.body.append(balance)
  onCoins((n) => (balance.innerHTML = `You have ${COIN}<b>${formatCash(n)}</b>`))

  const grid = document.createElement('div')
  grid.className = 'cs-grid'
  win.body.append(grid)

  for (const amount of COINS.packs) {
    const price = packPrice(amount)
    const card = document.createElement('div')
    card.className = 'cs-card'
    card.innerHTML = `<div class="cs-amount uiw-text">${COIN}<b>${amount.toLocaleString('en-US')}</b></div>`
    const buy = document.createElement('button')
    buy.type = 'button'
    buy.className = 'cs-buy uiw-text'
    buy.textContent = `${formatCash(price)}$`
    buy.addEventListener('click', () => {
      if (!hud.spend(price)) {
        buy.classList.remove('cs-short')
        void buy.offsetWidth
        buy.classList.add('cs-short')
        return
      }
      addCoins(amount)
      hud.toast(`+${amount.toLocaleString('en-US')} coins`)
    })
    card.append(buy)
    grid.append(card)
  }
  return win
}
