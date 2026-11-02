import { Vector3 } from 'three'
import { STANDS } from './config.js'
import { player } from './player.js'

// Hold-E prompts at the Sell and Shop stalls (the Treadmill Shop has its own on the Upgrades pad).
const REACH = 4.5 // metres from the stall's centre
const at = new Vector3()

// Where a world point lands on the screen as the prompt wants it (0..1), or null behind the camera.
export function screenPoint(camera, x, y, z) {
  at.set(x, y, z).project(camera)
  return at.z < 1 ? { x: (at.x + 1) / 2, y: (1 - at.y) / 2 } : null
}

// hud: the lobby HUD (prompt, comingSoon). sell: the Sell window. coins: the Coins window. run: the climb run.
export function createStallPrompts({ hud, camera, sell, coins, run }) {
  const stalls = [
    { source: 'sell', stand: STANDS.sell, text: 'Sell', open: () => sell.open() },
    { source: 'shop', stand: STANDS.shop, text: 'Buy Coins', open: () => coins.open() },
  ]
  return {
    // Once a frame.
    update() {
      const p = player.position
      const free = run.state() === 'idle' && !player.drive
      for (const { source, stand, text, open } of stalls) {
        const near = free && Math.hypot(stand.x - p.x, stand.z - p.z) < REACH
        const pt = near ? screenPoint(camera, stand.x, 3.2, stand.z) : null
        hud.prompt(pt && { ...pt, text, hold: true, act: open }, source)
      }
    },
  }
}
