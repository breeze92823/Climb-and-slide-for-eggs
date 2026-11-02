import { COINS } from './config.js'
import * as saves from './saves.js'

// The coin balance, kept in one place for the shop window, the HUD and every coin price.
// Saved through saves.js.
const listeners = new Set()

function load() {
  try {
    return Math.max(0, Math.floor(Number(saves.load(COINS.saveKey)?.coins) || 0))
  } catch {
    return 0 // No storage, or a bad save.
  }
}
let balance = null // read on first use: the save's owner is only set after this module loads

function change(next) {
  balance = next
  try {
    saves.store(COINS.saveKey, { coins: balance })
  } catch {
    // Storage blocked: the coins last this session.
  }
  for (const fn of listeners) fn(balance)
}

export const coins = () => (balance ??= load())
export const addCoins = (n) => change(coins() + n)
// Takes `n` coins; false if there aren't that many.
export function spendCoins(n) {
  if (coins() < n) return false
  change(coins() - n)
  return true
}
export function onCoins(fn) {
  listeners.add(fn)
  fn(coins())
}
// The cash a pack of `amount` coins costs: the base rate less a discount that deepens
// exponentially with the pack size.
export function packPrice(amount) {
  const discount = COINS.maxDiscount * (1 - Math.exp(-amount / COINS.discountScale))
  return Math.ceil(amount * COINS.cashPerCoin * (1 - discount))
}
