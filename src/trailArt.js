// The pictures on the Trail Shop's cards: a blocky runner in the trail's colour inside a swirl of
// it, painted on a 2D canvas once per trail and cached as a data URL. Rainbow (color 'rainbow')
// runs through every hue. The ribbon in the world is trailFx.js.
const SIZE = 400
const RAINBOW = ['#ff3b3b', '#ff9a2e', '#ffe03a', '#35e04a', '#2aa8ff', '#a45cff']
const cache = new Map()

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * k)))
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

// A limb or block: centre, size and tilt in degrees.
function block(ctx, fill, [x, y, w, h, deg]) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.fillStyle = fill
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.lineWidth = 5
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 16)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function paint(color) {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  const ctx = c.getContext('2d')
  const rainbow = color === 'rainbow'
  const paintFor = (x0, y0, x1, y1, k) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    if (rainbow) RAINBOW.forEach((h, i) => g.addColorStop(i / (RAINBOW.length - 1), h))
    else {
      g.addColorStop(0, shade(color, 1.18 * k))
      g.addColorStop(1, shade(color, 0.82 * k))
    }
    return g
  }

  // The swirl: three arcs round the runner's legs.
  ctx.lineCap = 'round'
  for (const [rx, ry, w, a] of [[170, 56, 16, 0.95], [140, 42, 11, 0.7], [105, 30, 8, 0.5]]) {
    ctx.globalAlpha = a
    ctx.strokeStyle = paintFor(40, 260, 300, 340, 1)
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.ellipse(215, 300, rx, ry, -0.12, Math.PI * 0.15, Math.PI * 1.85)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // The runner, leaning into a stride.
  const body = paintFor(150, 60, 330, 380, 1)
  const dark = paintFor(150, 60, 330, 380, 0.78)
  block(ctx, dark, [190, 335, 46, 120, 28]) // back leg
  block(ctx, dark, [140, 235, 42, 100, 40]) // back arm
  block(ctx, body, [250, 255, 112, 132, 22]) // torso
  block(ctx, body, [290, 345, 46, 120, -18]) // front leg
  block(ctx, body, [325, 245, 42, 110, -34]) // front arm
  block(ctx, body, [278, 150, 78, 78, 14]) // head
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.beginPath()
  ctx.roundRect(256, 128, 28, 14, 6)
  ctx.fill()
  return c.toDataURL()
}

// A data URL for a trail colour ('#rrggbb' or 'rainbow').
export function trailPicture(color) {
  if (!cache.has(color)) cache.set(color, paint(color))
  return cache.get(color)
}
