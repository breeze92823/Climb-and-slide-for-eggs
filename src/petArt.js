import {
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { INDEX, PLAYTIME } from './config.js'
import { toTexture } from './textures.js'

// Pictures for the Index window: every pet and egg is a small blocky model, rendered once
// on a throwaway WebGL context, one per animation frame so the game never stalls, on a
// transparent background. Each gives a colour picture and its black silhouette (the ???
// state) as data URLs, cached by id. Models and their colours live here, stats in config.
const SIZE = 256 // px, square
const INK = '#14131a'

// --- Blocks -----------------------------------------------------------------------------
function studTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 64, 64)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.32)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(20, 20)
  ctx.lineTo(20, 44)
  ctx.lineTo(44, 44)
  ctx.stroke()
  return toTexture(c, { srgb: true })
}

let studs = null
const mats = new Map()
function material(color, plain) {
  const key = `${color}${plain ? '|plain' : ''}`
  if (!mats.has(key)) mats.set(key, new MeshLambertMaterial({ color, map: plain ? null : studs }))
  return mats.get(key)
}

// One studded box. size [w, h, d], at [x, y, z] (its centre). Options: taper [top, bottom]
// narrows the top / bottom edge in x, rot [x, y, z], plain = no studs.
function box(group, [w, h, d], at, color, { taper, rot, plain } = {}) {
  const geo = new BoxGeometry(w, h, d)
  const uv = geo.attributes.uv
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  faces.forEach(([su, sv], f) => {
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, (uv.getX(i) * su) / 2, (uv.getY(i) * sv) / 2)
  })
  if (taper) {
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * (pos.getY(i) > 0 ? taper[0] : taper[1]))
    geo.computeVertexNormals()
  }
  const mesh = new Mesh(geo, material(color, plain))
  mesh.position.set(...at)
  if (rot) mesh.rotation.set(...rot)
  group.add(mesh)
  return mesh
}

// Flat face detail: a plate just proud of the surface, unshaded so whites stay white.
function plate(group, [w, h], [x, y, z], color) {
  const mesh = new Mesh(new BoxGeometry(w, h, 0.12), new MeshBasicMaterial({ color }))
  mesh.position.set(x, y, z)
  group.add(mesh)
}

// --- Critters ---------------------------------------------------------------------------
const EARS = {
  round: { size: [2.6, 2.4, 1.4], taper: [0.8, 1], rise: 0.9, out: 0.68 },
  pointy: { size: [3, 3.2, 1.4], taper: [0.12, 1], rise: 1.3, out: 0.62 },
  long: { size: [2, 6, 1.2], taper: [0.75, 1], rise: 2.8, out: 0.42 },
  big: { size: [3.8, 4.4, 1.2], taper: [0.45, 1], rise: 1.7, out: 0.5 },
  horns: { size: [1.3, 3.2, 1.3], taper: [0.2, 1], rise: 1.4, out: 0.56 },
  tuft: { size: [2.2, 2.2, 1.6], taper: [0.1, 1], rise: 1, out: 0.72 },
}

function addEars(g, s, topY, hw) {
  const e = EARS[s.ears]
  if (!e) return
  for (const side of [-1, 1]) {
    const at = [side * hw * e.out, topY + e.rise - 0.3, -0.4]
    box(g, e.size, at, s.earColor ?? s.head ?? s.color, { taper: e.taper })
    if (s.inner) box(g, [e.size[0] * 0.55, e.size[1] * 0.6, 0.3], [at[0], at[1] - 0.2, at[2] + e.size[2] / 2], s.inner, { taper: e.taper, plain: true })
  }
}

function addEyes(g, s, y, z) {
  const [w, h] = s.eye ?? [2.5, 2.9]
  const gap = s.eyeGap ?? 0.25
  for (const side of [-1, 1]) {
    const x = side * (w / 2 + gap)
    if (s.eyeRing) plate(g, [w + 1, h + 1], [x, y, z - 0.03], s.eyeRing)
    plate(g, [w, h], [x, y, z], s.eyeWhite ?? '#fff')
    plate(g, [w * 0.56, h * 0.62], [x + side * 0.1, y - 0.1, z + 0.05], s.pupil ?? '#0d0d12')
  }
}

function addWings(g, s, bw, bh, bd) {
  const c = s.wingColor ?? s.color
  const y = bh * 0.56
  if (s.wings === 'side') {
    // A folded wing lifted off the right side; the left one is out of sight behind the turn.
    box(g, [2.4, bh * 0.86, bd * 0.86], [bw / 2 + 1.5, y + 0.2, 0.4], c, { rot: [0, 0, -0.55] })
  } else if (s.wings === 'spread') {
    for (const side of [-1, 1]) {
      box(g, [7, 1.4, 3], [side * (bw / 2 + 2.8), y + 2.6, -0.5], c, { rot: [0, 0, side * 0.55] })
      box(g, [5.4, 4.4, 1], [side * (bw / 2 + 2.3), y - 0.5, -0.5], s.membrane ?? c, { rot: [0, 0, side * 0.55], taper: [1, 0.55] })
    }
  } else if (s.wings === 'bat') {
    for (const side of [-1, 1]) {
      box(g, [9.4, 1.1, 1.1], [side * (bw / 2 + 3.6), y + 3.5, 0], c, { rot: [0, 0, side * 0.46] })
      box(g, [1.1, 6.6, 1.1], [side * (bw / 2 + 7.5), y + 1.6, 0], c, { rot: [0, 0, side * -0.06] })
      box(g, [8, 6.4, 0.7], [side * (bw / 2 + 3.7), y - 0.1, -0.2], s.membrane, { taper: [0.95, 0.72] })
    }
  } else if (s.wings === 'fin') {
    for (const side of [-1, 1]) box(g, [1, bh * 0.66, bd * 0.46], [side * (bw / 2 + 1), y - 0.4, 0], c, { rot: [0, 0, side * 0.45] })
  }
}

function addTail(g, s, bw, bh, bd) {
  const c = s.tailColor ?? s.color
  if (s.tail === 'fan') box(g, [bw * 0.7, bh * 0.8, 1.4], [0, bh * 0.7, -bd / 2 - 1], c, { taper: [1.4, 0.7] })
  else if (s.tail === 'long') {
    box(g, [1.6, 1.6, 4], [bw / 2 + 0.2, bh * 0.45, -bd / 2 - 1], c)
    box(g, [1.6, 5, 1.6], [bw / 2 + 0.2, bh * 0.45 + 2, -bd / 2 - 2.6], c)
  } else if (s.tail === 'fluff') box(g, [4.2, 6, 3.4], [bw / 2 + 1.2, bh * 0.68, -bd / 2 - 0.4], c, { rot: [0, 0, -0.35], taper: [0.5, 0.85] })
}

// A chunky two-block animal, front on +Z. Everything but the body colour is optional.
function critter(s) {
  const g = new Group()
  const [bw, bh, bd] = s.bodySize ?? [8, 6.5, 7]
  const [hw, hh, hd] = s.headSize ?? [8.4, 6, 7]
  const legs = s.legs ?? 0
  const body = new Group()
  body.position.y = legs
  g.add(body)

  box(body, [bw, bh, bd], [0, bh / 2, 0], s.color, { taper: s.bodyTaper ?? [0.96, 0.84] })
  if (s.belly) box(body, [bw * 0.64, bh * 0.72, 0.4], [0, bh * 0.46, bd / 2 + 0.1], s.belly, { taper: [0.86, 0.7] })
  addWings(body, s, bw, bh, bd)
  addTail(body, s, bw, bh, bd)
  for (let i = 0; i < (s.spikes ?? 0); i++) box(body, [1.6, 2.4, 1.6], [0, bh + hh + 1, -hd / 2 + 1 + i * 2.4], s.spikeColor ?? s.color, { taper: [0.15, 1] })

  const headC = s.head ?? s.color
  box(body, [hw, hh, hd], [0, bh + hh / 2, 0.3], headC, { taper: s.headTaper ?? [0.84, 1] })
  if (s.mask) box(body, [hw * 0.74, hh * 0.56, 0.3], [0, bh + hh * 0.6, 0.3 + hd / 2 + 0.08], s.mask, { plain: true })
  addEars(body, s, bh + hh, hw)
  const z = 0.3 + hd / 2 + 0.26
  const eyeY = bh + hh * (s.eyeAt ?? 0.66)
  addEyes(body, s, eyeY, z)
  if (s.brow) box(body, [hw * 0.86, 0.8, 0.5], [0, eyeY + 2, z], s.brow, { plain: true })

  if (s.beak) {
    box(body, [3.8, hh * 0.92, 2], [0, bh + hh * 0.06, z + 0.8], s.beak, { taper: [1, 0.1], rot: [-0.1, 0, 0.08] })
  } else if (s.bill) {
    box(body, [4.6, 1.2, 2.4], [0, bh + hh * 0.26, z + 1], s.bill, { plain: true })
  } else if (s.snout) {
    box(body, [3.8, 2.3, 1], [0, bh + hh * 0.28, z + 0.2], s.snout, { plain: true })
    for (const side of [-1, 1]) plate(body, [0.6, 0.8], [side * 0.8, bh + hh * 0.3, z + 0.76], '#3a1c3c')
  }
  if (s.fangs) for (const side of [-1, 1]) box(body, [0.7, 1.1, 0.4], [side * 1.6, bh - 0.1, z - 0.1], '#fff', { plain: true, taper: [1, 0.2] })
  if (s.mouth) plate(body, [hw * 0.46, 0.7], [0, bh + hh * 0.2, z], s.mouth)

  if (legs) for (const side of [-1, 1]) {
    box(g, [2, legs, 2], [side * bw * 0.26, legs / 2, 0], s.legColor ?? s.color, { plain: true })
    box(g, [2.8, 0.7, 3.2], [side * bw * 0.26, 0.35, 0.5], s.footColor ?? s.legColor ?? s.color, { plain: true })
  }
  g.userData = { yaw: s.yaw, fit: s.fit }
  return g
}

function slime() {
  const g = new Group()
  box(g, [13, 7, 11], [0, 3.5, 0], '#7dea3c', { taper: [0.92, 1] })
  box(g, [10, 4, 9], [0, 9, 0], '#7dea3c', { taper: [0.72, 0.94] })
  box(g, [3, 2.6, 3], [3.6, 12, -1], '#a9f56d', { taper: [0.5, 1] })
  addEyes(g, { eye: [2.8, 3.6], eyeGap: 0.7 }, 7.4, 5.8)
  plate(g, [4.4, 1], [0, 3.8, 5.64], '#2b7a1c')
  return g
}

function jellyfish() {
  const g = new Group()
  box(g, [13, 6, 11], [0, 12, 0], '#ff7ad8', { taper: [0.62, 1] })
  box(g, [14, 2, 12], [0, 8.4, 0], '#d94fc0')
  addEyes(g, { eye: [2.5, 3] }, 12, 5.8)
  for (const x of [-5.6, -2, 2, 5.6]) {
    box(g, [1.8, 5, 1.8], [x, 5, 1], '#ffa8e6')
    box(g, [1.4, 4, 1.4], [x * 1.1, 1, 1], '#7cd9ff')
  }
  return g
}

function kraken() {
  const g = new Group()
  box(g, [12, 11, 10], [0, 10.5, 0], '#b3263d', { taper: [0.6, 1] })
  addEyes(g, { eye: [3, 3.4], eyeRing: '#ffdb4d', pupil: '#30101a' }, 9.4, 5.3)
  for (const side of [-1, 1]) {
    for (const k of [0.45, 1]) {
      box(g, [2.4, 8, 2.4], [side * (3 + 4.4 * k), 3.8 + 2 * k, 0.4], '#8d1a30', { rot: [0, 0, side * 0.32 * k] })
      box(g, [1.8, 4, 1.8], [side * (4.4 + 7.4 * k), 6 + 4 * k, 0.4], '#ff6d7f', { rot: [0, 0, side * -0.5] })
    }
  }
  return g
}

// The Playtime Rewards' own pets.
function lion() {
  const g = critter({ color: '#e8a43c', head: '#f2b752', belly: '#f6d48c', snout: '#fbe3b0', ears: 'round', earColor: '#8a4a1c', tail: 'long', tailColor: '#8a4a1c', headSize: [9.4, 6.6, 7.4], bodySize: [9, 7, 7.6] })
  box(g, [14, 11.6, 4], [0, 10.2, -1.4], '#a4581e') // the mane
  return g
}

function snail() {
  const g = new Group()
  const skin = '#f2b294'
  box(g, [6, 3, 17], [0, 1.5, 0.5], skin)
  box(g, [6, 8, 4.4], [0, 6.5, 6.8], skin, { taper: [0.9, 1] })
  for (const side of [-1, 1]) box(g, [1.1, 3.4, 1.1], [side * 1.9, 12, 6.8], skin)
  addEyes(g, { eye: [1.9, 2.4], eyeGap: 0.3 }, 8.2, 9.1)
  box(g, [9, 12.6, 12.6], [0, 9, -2.6], '#7a4a26')
  box(g, [9.8, 7, 7], [0, 9, -2.6], '#c4874a')
  box(g, [10.4, 2.6, 2.6], [0, 9, -2.6], '#5a3218')
  g.userData = { yaw: 0.95 }
  return g
}

function ostrich() {
  const g = new Group()
  const skin = '#f2a6b4'
  for (const side of [-1, 1]) {
    box(g, [1.5, 8, 1.5], [side * 2.3, 4, 0], skin, { plain: true })
    box(g, [2.4, 0.9, 3.4], [side * 2.3, 0.45, 0.8], skin, { plain: true })
  }
  box(g, [10, 7.6, 12], [0, 11.6, -0.6], '#2b2830', { taper: [0.78, 1] })
  box(g, [6.4, 2.4, 3], [0, 13.6, -7.4], '#f6f2ea')
  box(g, [2.1, 11, 2.3], [0, 19.6, 3.6], skin)
  box(g, [5, 3.6, 5.4], [0, 26, 4.6], skin)
  box(g, [2.8, 1, 3], [0, 25.4, 8.4], '#f2c060', { plain: true })
  addEyes(g, { eye: [1.6, 1.9], eyeGap: 0.5 }, 26.5, 7.4)
  g.userData = { yaw: 0.5, fit: 1 }
  return g
}

// Whales and their kin: a long body, tail flukes, flippers. Options: dorsal, horn, teeth.
function swimmer(s) {
  const g = new Group()
  box(g, [13, 9, 24], [0, 5.5, 0], s.color, { taper: [0.9, 0.7] })
  box(g, [11, 3, 20], [0, 2.4, 1], s.belly, { plain: true })
  box(g, [10, 6, 5], [0, 6.5, -13], s.fin)
  box(g, [12, 1.4, 4], [0, 9.6, -15.5], s.fin, { rot: [0.3, 0, 0] })
  for (const side of [-1, 1]) {
    box(g, [1.6, 4, 7], [side * 7.4, 3, 2], s.fin, { rot: [0, 0, side * 0.5] })
    plate(g, [2.6, 2.6], [side * 6.52, 7.4, 8], '#ffffff')
    plate(g, [1.3, 1.3], [side * 6.54, 7.4, 8.05], '#10141e')
  }
  if (s.dorsal) box(g, [1.6, 6, 6], [0, 12, -3], s.fin, { taper: [0.3, 1], rot: [-0.4, 0, 0] })
  if (s.horn) box(g, [1.6, 1.6, 12], [0, 7, 17], s.horn)
  if (s.teeth) for (const x of [-4, -2, 0, 2, 4]) box(g, [1, 1.4, 0.5], [x, 4.4, 12.2], '#fff', { plain: true, taper: [0.2, 1] })
  g.userData = { yaw: 0.9, fit: 1.02 }
  return g
}

// A critter with parts added: parts(g, p), where p holds where its head and body ended up.
function decorated(s, parts) {
  const g = critter(s)
  const legs = s.legs ?? 0
  const [bw, bh, bd] = s.bodySize ?? [8, 6.5, 7]
  const [hw, hh, hd] = s.headSize ?? [8.4, 6, 7]
  parts(g, { bw, bh, bd, hw, hh, hd, legs, top: legs + bh + hh, mid: legs + bh + hh / 2, front: 0.3 + hd / 2 + 0.3 })
  return g
}

const horn = (g, p, color, len = 5) => box(g, [1.6, len, 1.6], [0, p.top + len / 2 - 0.3, 2], color, { taper: [0.1, 1] })
const trunk = (g, p, color) => box(g, [2.8, 9, 2.6], [0, p.mid - 3.6, p.front + 1], color, { taper: [1, 0.7] })
const mane = (g, p, color) => box(g, [p.hw + 3.4, p.hh + 4, 3.6], [0, p.mid + 0.4, -p.hd / 2 - 0.2], color)
function tusks(g, p, color) {
  for (const side of [-1, 1]) box(g, [1.3, 5, 1.3], [side * 2.8, p.mid - 4, p.front + 0.6], color, { plain: true, taper: [0.3, 1], rot: [0.3, 0, 0] })
}
function antlers(g, p, color) {
  for (const side of [-1, 1]) {
    box(g, [1, 6, 1], [side * 2.8, p.top + 2.6, 0], color, { rot: [0, 0, side * -0.3] })
    box(g, [3.4, 1, 1], [side * 4.6, p.top + 3.6, 0], color)
    box(g, [1, 3, 1], [side * 5.8, p.top + 5, 0], color)
  }
}
// Bands across the body's top and side.
function stripes(g, p, color, n = 3) {
  for (let i = 0; i < n; i++) box(g, [p.bw + 0.2, p.bh * 0.82, 0.9], [0, p.legs + p.bh * 0.54, p.bd / 2 - 1.4 - (i * (p.bd - 2)) / n], color, { plain: true, taper: [0.96, 0.84] })
}
function shell(g, p, color, rim) {
  box(g, [p.bw + 3.6, p.bh * 0.5, p.bd + 4.4], [0, p.legs + p.bh * 0.5, -0.8], rim)
  box(g, [p.bw + 1.6, p.bh * 0.5, p.bd + 2.4], [0, p.legs + p.bh * 0.92, -0.8], color)
}
function backSpikes(g, p, color, n = 3) {
  for (let i = 0; i < n; i++) box(g, [1.4, 2.6, 1.8], [0, p.legs + p.bh + 0.8, -p.bd / 2 + 0.4 - i * 1.6], color, { taper: [0.15, 1] })
}
function crystals(g, p, color, tip) {
  for (const [x, z, h] of [[-2, -1, 5], [1.6, -2, 7], [3.4, 0.6, 4]]) box(g, [2, h, 2], [x, p.legs + p.bh + h / 2 - 1.4, z - p.bd / 2 + 1], z < -1 ? tip : color, { taper: [0.2, 1], plain: true })
}

function fish(s) {
  const g = new Group()
  const [w, h, l] = s.size ?? [8, 11, 15]
  const c = s.finColor ?? s.color
  box(g, [w, h, l], [0, h / 2 + 1, 0], s.color, { taper: [0.74, 0.74] })
  if (s.belly) box(g, [w * 0.78, h * 0.3, l * 0.84], [0, h * 0.2 + 1, 0.7], s.belly, { plain: true })
  box(g, [1.4, h * 1.1, 5.4], [0, h / 2 + 1, -l / 2 - 2.4], c)
  box(g, [1.2, 3.6, l * 0.52], [0, h + 2.2, -1], c)
  for (const side of [-1, 1]) box(g, [1, h * 0.4, 3.6], [side * (w / 2 + 0.6), h * 0.46 + 1, 1.6], c, { rot: [0, 0, side * 0.5] })
  addEyes(g, { eye: s.eye ?? [2.6, 3.2], eyeGap: 0.3, eyeRing: s.eyeRing, pupil: s.pupil }, h * 0.68 + 1, l / 2 + 0.14)
  if (s.mouth) plate(g, [w * 0.5, 0.9], [0, h * 0.34 + 1, l / 2 + 0.14], s.mouth)
  if (s.teeth) for (const x of [-2, 0, 2]) box(g, [1, 1.4, 0.4], [x, h * 0.3 + 1, l / 2 + 0.2], '#fff', { plain: true, taper: [1, 0.15] })
  if (s.stripe) box(g, [w + 0.2, h * 0.7, 1.6], [0, h / 2 + 1, -1.6], s.stripe, { plain: true, taper: [0.74, 0.74] })
  if (s.spikes) {
    for (const side of [-1, 1]) {
      for (const y of [0.3, 0.7]) for (const z of [-3, 2]) box(g, [2.4, 1, 1], [side * (w / 2 + 0.4), h * y + 1, z], s.spikes, { taper: [1, 1] })
    }
    for (const x of [-2.2, 2.2]) box(g, [1, 2.4, 1], [x, h + 1.6, 2], s.spikes, { taper: [0.15, 1] })
  }
  if (s.lure) {
    box(g, [0.8, 6, 0.8], [0, h + 3.4, l / 2 - 1.6], c, { rot: [0.6, 0, 0] })
    box(g, [2.4, 2.4, 2.4], [0, h + 6.2, l / 2 + 0.4], s.lure, { plain: true })
  }
  g.userData = { yaw: s.yaw ?? 0.6, fit: 1.04 }
  return g
}

// Six legs, a round back, a small head. Options: spots, wings, sting (a raised tail with
// pincers up front), pair (legs pairs, 4 = a spider).
function bug(s) {
  const g = new Group()
  const legC = s.legColor ?? '#2b2730'
  box(g, [11, 6.4, 13], [0, 4.8, -1], s.color, { taper: [0.74, 1] })
  box(g, [6.8, 4.8, 4.8], [0, 4.4, 7.4], s.head ?? legC)
  for (const side of [-1, 1]) {
    for (let i = 0; i < (s.pair ?? 3); i++) box(g, [6, 1, 1], [side * 7.4, 1.8, 3.6 - i * (8 / (s.pair ?? 3))], legC, { rot: [0, 0, side * -0.5], plain: true })
    box(g, [0.8, 4, 0.8], [side * 1.8, 8.4, 9], legC, { rot: [0.4, 0, side * 0.25] })
  }
  addEyes(g, { eye: [2.4, 2.8], eyeGap: 0.3, eyeRing: s.eyeRing }, 5, 9.9)
  for (const [x, y, z] of s.spots ?? []) box(g, [2.6, 2.6, 2.6], [x, y, z], s.spotColor, { plain: true })
  if (s.bands) for (const z of [1, -2.4, -5.8]) box(g, [11.2, 6.6, 1.4], [0, 4.8, z], s.bands, { plain: true, taper: [0.74, 1] })
  if (s.wings) for (const side of [-1, 1]) box(g, [8, 0.8, 11], [side * 5.8, 9.6, -2.6], s.wings, { rot: [0.2, 0, side * 0.42] })
  if (s.glow) box(g, [8, 4, 4], [0, 4.8, -7.8], s.glow, { plain: true })
  if (s.sting) {
    box(g, [2.2, 2.2, 7], [0, 4.4, -10], s.color)
    box(g, [2.2, 10, 2.2], [0, 9, -12.6], s.color)
    box(g, [2, 3, 2], [0, 15, -10.8], s.sting, { taper: [0.15, 1], rot: [1, 0, 0] })
    for (const side of [-1, 1]) {
      box(g, [1.8, 1.8, 7], [side * 5, 3.6, 8.6], s.color, { rot: [0, side * 0.3, 0] })
      box(g, [3.6, 2.4, 3.4], [side * 6.2, 3.6, 12.6], s.sting)
    }
  }
  g.userData = { yaw: s.yaw ?? 0.6, fit: 1.04 }
  return g
}

// Spread wings on a thin body, seen from the front.
function flutter(s) {
  const g = new Group()
  for (const side of [-1, 1]) {
    box(g, [10, 10, 1], [side * 6.4, 13, 0], s.wing, { taper: [1, 0.6] })
    box(g, [8, 8, 1], [side * 5.4, 5.4, 0], s.wing2 ?? s.wing, { taper: [0.6, 1] })
    if (s.dot) box(g, [3.6, 3.6, 1.2], [side * 7, 13, 0.1], s.dot, { plain: true })
    box(g, [0.8, 5, 0.8], [side * 1.4, 18.6, 1.4], s.body, { rot: [0.2, 0, side * 0.3] })
  }
  box(g, [3.8, 13, 3.8], [0, 8.6, 1], s.body)
  box(g, [5, 4.6, 4.2], [0, 15, 1.2], s.head ?? s.body)
  addEyes(g, { eye: [1.8, 2], eyeGap: 0.2 }, 15.4, 3.42)
  g.userData = { yaw: 0.25, fit: 1.04 }
  return g
}

// A round stack of rings, widest at the bottom, the head on top.
function coil(s) {
  const g = new Group()
  const rings = s.rings ?? [[16, 3.4], [13, 3.4], [10, 3.4]]
  let y = 0
  rings.forEach(([w, h], i) => {
    box(g, [w, h, w], [0, y + h / 2, 0], i % 2 && s.band ? s.band : s.color)
    y += h
  })
  box(g, [8, 5, 8.4], [0, y + 2.2, 1.6], s.head ?? s.color)
  addEyes(g, { eye: [2.4, 2.8], eyeGap: 0.5, pupil: s.pupil }, y + 3, 6.1)
  if (s.tongue) box(g, [1, 0.5, 3], [0, y + 0.9, 6.8], s.tongue, { plain: true })
  if (s.fangs) for (const side of [-1, 1]) box(g, [0.8, 1.6, 0.4], [side * 1.6, y + 0.3, 5.9], '#fff', { plain: true, taper: [1, 0.2] })
  if (s.glow) box(g, [6, 2, 6], [0, y + 5.4, 1.6], s.glow, { plain: true })
  g.userData = { yaw: 0.4, fit: 1.04 }
  return g
}

// On long legs with a long neck: the head stands high.
function stilts(s) {
  const g = new Group()
  const legH = s.legH ?? 8
  const neck = s.neck ?? 11
  const leg = s.legColor ?? s.color
  const [bw, bh, bd] = s.bodySize ?? [9, 7.6, 12]
  for (const side of [-1, 1]) {
    box(g, [1.8, legH, 1.8], [side * 2.3, legH / 2, 2.6], leg, { plain: true })
    if (s.four) box(g, [1.8, legH, 1.8], [side * 2.3, legH / 2, -3.6], leg, { plain: true })
  }
  const top = legH + bh
  box(g, [bw, bh, bd], [0, legH + bh / 2, -0.6], s.color, { taper: [0.82, 1] })
  if (s.wing) box(g, [bw + 1, bh * 0.6, bd * 0.72], [0, legH + bh * 0.56, -1], s.wing)
  box(g, [2.8, neck, 2.8], [0, top + neck / 2 - 1, 3.6], s.neckColor ?? s.color)
  const y = top + neck - 1
  box(g, [5.4, 4.2, 6.2], [0, y + 1.6, 4.8], s.head ?? s.color)
  if (s.bill) box(g, [3, 1.4, 3.6], [0, y + 0.8, 9.2], s.bill, { plain: true, taper: [1, 0.7] })
  if (s.ears) for (const side of [-1, 1]) box(g, [1.6, 3, 1.2], [side * 2.2, y + 4.8, 3.6], s.color, { taper: [0.3, 1] })
  addEyes(g, { eye: [1.9, 2.2], eyeGap: 0.5 }, y + 2.2, 8.04)
  if (s.patches) for (const [x, py, z] of s.patches) box(g, [2.4, 2.4, 2.4], [x, py, z], s.patch, { plain: true })
  if (s.crown) box(g, [3, 1.6, 3.4], [0, y + 4.4, 4.6], s.crown)
  g.userData = { yaw: 0.5, fit: 1 }
  return g
}

function trex() {
  const g = new Group()
  const hide = '#d4a820'
  const dark = '#a87c10'
  for (const side of [-1, 1]) box(g, [3.4, 8, 4.4], [side * 3.6, 4, -1], dark, { plain: true })
  box(g, [10, 11, 12], [0, 12.4, -1], hide, { taper: [0.82, 1] })
  box(g, [6, 5, 10], [0, 11, -11], hide, { taper: [0.7, 1] })
  box(g, [10.4, 8, 12], [0, 20.8, 3], hide)
  box(g, [10.4, 2.4, 8], [0, 16.2, 6.4], dark)
  for (const side of [-1, 1]) box(g, [1.4, 1.4, 4], [side * 5.4, 13.6, 5], dark)
  for (const x of [-3.6, -1.2, 1.2, 3.6]) box(g, [1.3, 1.8, 0.5], [x, 17.4, 9.1], '#fff', { plain: true, taper: [0.2, 1] })
  addEyes(g, { eye: [2.2, 2.4], eyeGap: 1.4, eyeRing: '#ffe680' }, 22.6, 9.14)
  g.userData = { yaw: 0.45, fit: 1 }
  return g
}

function hydra() {
  const g = new Group()
  const [skin, skin2] = ['#2fc9b0', '#ff5aa8']
  box(g, [13, 9, 13], [0, 4.5, -1], skin, { taper: [0.84, 1] })
  box(g, [9, 6, 0.6], [0, 4.2, 5.6], '#ffe05a', { plain: true })
  for (const [x, lean, rise] of [[-6, -0.42, 11], [0, 0, 14], [6, 0.42, 11]]) {
    box(g, [2.8, rise, 2.8], [x, 8 + rise / 2, 2], skin2, { rot: [0, 0, -lean] })
    const hx = x + (Math.sin(lean) * rise) / 2
    const hy = 8 + rise / 2 + (Math.cos(lean) * rise) / 2
    box(g, [5.4, 4.2, 6.2], [hx, hy + 1, 3], skin)
    addEyes(g, { eye: [1.7, 2], eyeGap: 0.4 }, hy + 1.6, 6.24)
    for (const side of [-1, 1]) box(g, [1, 2.4, 1], [hx + side * 1.8, hy + 4, 2], '#ffe05a', { taper: [0.15, 1] })
  }
  g.userData = { yaw: 0.3, fit: 1.02 }
  return g
}

function starfish() {
  const g = new Group()
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    box(g, [4.6, 10, 2.6], [Math.sin(a) * 6.4, 10 + Math.cos(a) * 6.4, 0], i % 2 ? '#ff5a9e' : '#ff8a3c', { taper: [0.32, 1], rot: [0, 0, -a] })
  }
  box(g, [8, 8, 3.4], [0, 10, 0], '#ffb04a')
  addEyes(g, { eye: [2, 2.4], eyeGap: 0.3 }, 11, 1.84)
  plate(g, [3, 0.7], [0, 8, 1.84], '#a0284c')
  g.userData = { yaw: 0.2, fit: 1.04 }
  return g
}

function octopus() {
  const g = new Group()
  box(g, [12, 11, 11], [0, 11, 0], '#7a4dff', { taper: [0.66, 1] })
  addEyes(g, { eye: [3, 3.4], eyeRing: '#ffe05a' }, 10, 5.64)
  ;[-6, -3.4, -1, 1.4, 3.8, 6.2].forEach((x, i) => {
    box(g, [2.2, 7, 2.2], [x, 3.4, 2 + (i % 2) * -3], i % 2 ? '#ff5ab0' : '#3fd0ff', { rot: [0, 0, x * 0.06] })
  })
  g.userData = { yaw: 0.3, fit: 1.04 }
  return g
}

function seahorse() {
  const g = new Group()
  const [skin, fin] = ['#ffb02e', '#ff5a9e']
  box(g, [4, 7, 4], [0, 3.5, -1.6], skin, { taper: [1, 0.5] })
  box(g, [7, 9, 6], [0, 11, 0], skin, { taper: [0.8, 0.7] })
  box(g, [4.6, 8, 0.5], [0, 11, 3.1], '#ffe6a0', { plain: true })
  box(g, [6.4, 5.4, 6.4], [0, 18, 1], skin)
  box(g, [2.6, 2, 5], [0, 17.4, 6], skin)
  box(g, [1, 8, 4], [0, 13, -3.8], fin)
  for (const z of [-1, 1, 3]) box(g, [1.4, 2.4, 1.4], [0, 21.6, z], fin, { taper: [0.15, 1] })
  addEyes(g, { eye: [1.7, 2], eyeGap: 0.7 }, 18.6, 4.3)
  g.userData = { yaw: 0.6, fit: 1 }
  return g
}

function crab() {
  const g = new Group()
  const [shellC, leg] = ['#7ce8ff', '#3fa8d8']
  box(g, [15, 6, 10], [0, 5, 0], shellC, { taper: [0.8, 0.9] })
  for (const side of [-1, 1]) {
    for (const z of [-3, 0, 3]) box(g, [6, 1.2, 1.2], [side * 9.4, 2.2, z], leg, { rot: [0, 0, side * -0.55], plain: true })
    box(g, [1.8, 5, 1.8], [side * 8.6, 7.6, 4], leg, { rot: [0, 0, side * -0.3] })
    box(g, [5, 4.6, 4], [side * 10.4, 11, 4], '#f0fbff')
    box(g, [1, 3.4, 1], [side * 2.4, 9.4, 3], leg)
    plate(g, [2.4, 2.4], [side * 2.4, 11.4, 3.6], '#fff')
    plate(g, [1.2, 1.3], [side * 2.4, 11.4, 3.7], '#0d0d12')
  }
  plate(g, [4, 0.7], [0, 4.4, 5.06], '#1f6a8a')
  g.userData = { yaw: 0.2, fit: 1.04 }
  return g
}

function worm() {
  const g = new Group()
  const c = ['#b8ff3c', '#7cf03a', '#4de06a']
  ;[[9, 0, -1], [8.4, 3.4, 0], [7.8, 7, 1.2], [7, 10.6, 2.6]].forEach(([w, y, z], i) => box(g, [w, 4, w], [0, y + 2, z], c[i % 3]))
  addEyes(g, { eye: [2.2, 2.6], eyeGap: 0.3 }, 12.8, 6.3)
  box(g, [5.6, 2, 5.6], [0, 15.4, 2.6], '#eaff6a', { plain: true })
  g.userData = { yaw: 0.45, fit: 1.04 }
  return g
}


function sphinx() {
  const g = new Group()
  const sand = '#e8c060'
  const stripe = (i) => (i % 2 ? '#2a5fc8' : '#f4cc3c')
  box(g, [10.4, 6, 15], [0, 3, -1.6], sand)
  for (const side of [-1, 1]) box(g, [3, 2.6, 7.4], [side * 3.4, 1.3, 8.4], '#f0cf78')
  box(g, [8.4, 7, 6], [0, 9.4, 2], sand)
  box(g, [8, 7.8, 6.6], [0, 16.4, 2.6], '#e9b67a')
  for (let i = 0; i < 4; i++) box(g, [10.6 - i * 1.5, 1.2, 8 - i * 0.8], [0, 20.8 + i * 1.2, 2.2], stripe(i))
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) box(g, [2.5, 1.6, 6], [side * 5.1, 19.9 - i * 1.7, 2.2], stripe(i))
  }
  addEyes(g, { eye: [2, 2.3], eyeGap: 0.55 }, 17, 5.98)
  plate(g, [3, 0.7], [0, 14, 5.98], '#8a5230')
  box(g, [1.4, 3.6, 1.2], [0, 11.6, 5.6], stripe(0))
  g.userData = { yaw: 0.3, fit: 1 }
  return g
}

// Bat, as in the reference: dark bat-winged body, big pink ears, pig snout.
const PETS = {
  chick: () => critter({ color: '#ffd93b', beak: '#ff9a1f', wings: 'fin', legs: 1.2, legColor: '#ff9a1f', bodySize: [9, 6, 8], headSize: [8.6, 6, 7], ears: 'tuft', earColor: '#ffc21a' }),
  parrot: () => critter({ color: '#2fd11e', head: '#f22a24', beak: '#ffc02e', wings: 'side', wingColor: '#1c8f19', headSize: [10, 7, 8.4], bodySize: [10, 7.4, 8.4], eye: [3.4, 3.6], eyeGap: 0.15, eyeAt: 0.72, yaw: 0.5 }),
  penguin: () => critter({ color: '#26303f', belly: '#f7f7f7', mask: '#f7f7f7', beak: '#ff9a1f', wings: 'fin', legs: 1, legColor: '#ff9a1f', bodySize: [9, 8, 8] }),
  bat: () => critter({ color: '#2f2355', belly: '#ff6fb5', ears: 'big', earColor: '#f58ccb', inner: '#ffb3dd', wings: 'bat', wingColor: '#231a45', membrane: '#f0559f', snout: '#ff9ccc', fangs: true, legs: 1.6, footColor: '#f58ccb', bodySize: [6.6, 6, 5], headSize: [8.4, 5.6, 6], eye: [2.9, 2.9], eyeAt: 0.6, yaw: 0.12, fit: 0.84 }),
  owl: () => critter({ color: '#a86b34', belly: '#f1d7a8', ears: 'tuft', beak: '#f2b02c', wings: 'fin', eye: [2.9, 3.2], eyeRing: '#f1d7a8', pupil: '#2b1606', bodySize: [9.6, 7.5, 8], headSize: [10, 6.4, 7.6] }),
  raccoon: () => critter({ color: '#8c8f99', belly: '#d6d8de', mask: '#2b2d35', ears: 'round', snout: '#d6d8de', tail: 'fluff', tailColor: '#5a5c66', bodySize: [8.6, 7, 7.4], headSize: [10.4, 6.8, 7.4] }),
  sheep: () => critter({ color: '#fbf7f2', head: '#3b3540', ears: 'round', earColor: '#3b3540', mouth: '#fbf7f2', headSize: [7.4, 6, 6.4], bodySize: [12, 8.6, 9], legs: 1.4, legColor: '#3b3540' }),
  fox: () => critter({ color: '#ff8a23', belly: '#fff1e2', ears: 'pointy', inner: '#fff1e2', snout: '#fff1e2', tail: 'fluff', tailColor: '#ff6a10', headSize: [10, 6.6, 7.4], bodySize: [8.6, 7, 7.4] }),
  pegasus: () => critter({ color: '#f4f0ff', ears: 'horns', earColor: '#ffd65c', wings: 'spread', wingColor: '#cfe2ff', snout: '#d8c8ff', bodySize: [9, 7.4, 8], legs: 1.4, tail: 'fan', tailColor: '#b48cff' }),
  monkey: () => critter({ color: '#7a4a24', belly: '#e0b98c', mask: '#e0b98c', ears: 'round', earColor: '#e0b98c', snout: '#c8966a', tail: 'long', headSize: [9.4, 6.6, 7.4] }),
  tiger: () => critter({ color: '#ff9e24', belly: '#fff3dc', ears: 'round', snout: '#fff3dc', brow: '#2b1a10', fangs: true, tail: 'long', headSize: [10, 6.8, 7.6], bodySize: [9, 7, 7.6] }),
  toucan: () => critter({ color: '#17181f', belly: '#ffe45c', beak: '#ff7a1c', wings: 'side', wingColor: '#2b2d3a', headSize: [8.6, 6.8, 7], eyeRing: '#3fd0ff' }),
  imp: () => critter({ color: '#e0352f', belly: '#ff8f6b', ears: 'horns', earColor: '#2b2030', wings: 'bat', wingColor: '#7a1420', membrane: '#b92130', fangs: true, mouth: '#4a0a10', bodySize: [6.6, 6, 5.4], headSize: [8, 6, 6.6] }),
  phoenix: () => critter({ color: '#ff5a1f', belly: '#ffd03a', beak: '#ffe25c', ears: 'tuft', earColor: '#ffb21f', wings: 'spread', wingColor: '#ff8a1f', membrane: '#ffcf3a', tail: 'fan', tailColor: '#ffb21f', headSize: [7.6, 6, 6.6], bodySize: [7.4, 7, 7] }),
  dragon: () => critter({ color: '#7a1fd0', belly: '#ffcc4d', ears: 'horns', earColor: '#ffcc4d', wings: 'spread', wingColor: '#5a14a4', membrane: '#c23dff', snout: '#9d4bef', fangs: true, spikes: 3, spikeColor: '#ffcc4d', headSize: [9.6, 6.6, 8] }),
  frog: () => critter({ color: '#3fc93a', belly: '#d8f79a', headSize: [11, 5.4, 8], bodySize: [10, 6, 8], eye: [2.8, 3], eyeGap: 1.2, eyeAt: 0.96, mouth: '#1c6b1a' }),
  slime,
  alien: () => critter({ color: '#62e27a', head: '#7ff08f', eye: [3.4, 4.2], eyeWhite: '#0f1419', pupil: '#2c6b3a', eyeGap: 0.5, ears: 'horns', earColor: '#3fae59', headSize: [11, 8, 8], bodySize: [6.4, 6, 5.4], headTaper: [1, 0.72], eyeAt: 0.55 }),
  jellyfish,
  kraken,
  koala: () => critter({ color: '#5c5674', head: '#50496a', belly: '#918ba8', ears: 'round', earColor: '#6f688a', inner: '#b9b3cd', snout: '#2d2a3a', eye: [2.6, 3], headSize: [9.6, 6.6, 7.4], bodySize: [8, 6.5, 7] }),
  capybara: () => critter({ color: '#b27a44', head: '#a46d3a', belly: '#d9b07a', ears: 'round', earColor: '#8a5a30', snout: '#6e4524', legs: 1.4, legColor: '#8a5a30', bodySize: [10, 7, 9], headSize: [8.6, 6, 7.4], eye: [2, 2.4], eyeAt: 0.7 }),
  bear: () => critter({ color: '#7a3b1e', belly: '#a65a2c', ears: 'round', earColor: '#5e2a14', snout: '#d9a36a', legs: 1.2, legColor: '#5e2a14', bodySize: [10, 8, 8.4], headSize: [10, 6.8, 7.6] }),
  lion,
  snail,
  ostrich,
  sphinx,

  // Gold
  goldDuck: () => critter({ color: '#ffc81e', belly: '#ffe680', bill: '#ff8a1f', wings: 'fin', wingColor: '#e8a410', legs: 1.2, legColor: '#ff8a1f', tail: 'fan', eye: [2.4, 2.8], bodySize: [9, 6.6, 8], headSize: [7.6, 5.8, 6.6] }),
  pigeon: () => critter({ color: '#a8acb8', head: '#5f7fa0', belly: '#d4d6dc', beak: '#e8a020', wings: 'side', wingColor: '#7f8494', legs: 1.2, legColor: '#ff7a6a', tail: 'fan', tailColor: '#6a6f7e', eyeRing: '#ffa04a', headSize: [7, 5.4, 6], bodySize: [9, 7, 8.4] }),
  hamster: () => critter({ color: '#ffb84a', belly: '#fff0d0', mask: '#fff0d0', ears: 'round', earColor: '#e89528', inner: '#ffc8c0', snout: '#ffd8c8', eye: [2.2, 2.6], bodySize: [9.4, 6.4, 8], headSize: [10.4, 6.4, 7.4] }),
  squirrel: () => critter({ color: '#d98a24', belly: '#ffe2a8', ears: 'tuft', snout: '#ffe2a8', tail: 'fluff', tailColor: '#f2a832', headSize: [8.6, 6, 7], bodySize: [7.4, 7, 6.6] }),
  hedgehog: () => decorated({ color: '#e8c48a', head: '#f6dcae', ears: 'round', snout: '#8a5a30', eye: [2, 2.4], bodySize: [9.6, 6.4, 8], headSize: [8, 5.4, 6.8] }, (g, p) => {
    box(g, [13, 9, 12], [0, p.bh * 0.7, -2.8], '#c89620')
    for (const [x, y, z] of [[-4, 11, -5], [0, 12, -3], [4, 11, -5], [-5, 7, 0], [5, 7, 0], [0, 12, -7]]) box(g, [2, 3.4, 2], [x, y, z], '#ffd24a', { taper: [0.1, 1] })
  }),
  beaver: () => decorated({ color: '#b8802a', belly: '#e0b870', ears: 'round', snout: '#7a4a1c', fangs: true, bodySize: [10, 7, 9], headSize: [9, 6, 7] }, (g, p) => box(g, [7, 1.6, 9], [0, 1.6, -p.bd / 2 - 3.8], '#ffc832', { rot: [-0.2, 0, 0] })),
  cow: () => decorated({ color: '#fff4d8', head: '#fff4d8', ears: 'horns', earColor: '#ffc832', snout: '#ffb4a8', legs: 2.8, legColor: '#c89620', bodySize: [11, 7.6, 9.6], headSize: [8.6, 6.4, 7] }, (g, p) => {
    for (const [x, y, z] of [[5.6, 8, 2], [5.6, 6, -3], [-5.6, 7, -1]]) box(g, [1.2, 4, 3.6], [x, y, z], '#d4a020', { plain: true })
    box(g, [3.4, 3, 0.4], [-2, p.mid + 1, p.front - 0.1], '#d4a020', { plain: true })
  }),
  horse: () => decorated({ color: '#d8a030', head: '#e0ac3c', ears: 'pointy', snout: '#fff0c0', legs: 3.4, legColor: '#a87818', tail: 'fan', tailColor: '#fff0c0', bodySize: [9, 7.4, 9.6], headSize: [7, 7, 7.4] }, (g, p) => box(g, [2.4, p.hh + 3, 2.8], [0, p.mid + 0.6, -p.hd / 2 + 0.2], '#fff0c0')),
  goat: () => decorated({ color: '#fff0c8', head: '#ffe8b4', ears: 'horns', earColor: '#d4a020', snout: '#ffcfa8', legs: 2.2, legColor: '#d4a020', tail: 'fan', eye: [2.2, 2.2], bodySize: [9, 7, 8.4], headSize: [7.4, 6, 6.6] }, (g, p) => box(g, [2.2, 3.4, 1.6], [0, p.legs + p.bh - 0.6, p.front + 0.2], '#ffc832', { taper: [1, 0.3] })),
  panda: () => critter({ color: '#fff8e8', belly: '#1e1a12', ears: 'round', earColor: '#1e1a12', eyeRing: '#1e1a12', snout: '#ffd24a', legs: 1.6, legColor: '#1e1a12', bodySize: [10.6, 8, 9], headSize: [10.4, 7, 7.6] }),
  sloth: () => critter({ color: '#a8842e', head: '#d8bc70', mask: '#f2e0a4', eyeRing: '#6a4c14', snout: '#6a4c14', eye: [2, 2.4], legs: 1, bodySize: [8.6, 8, 7.4], headSize: [8.6, 6.4, 6.6] }),
  flamingo: () => stilts({ color: '#ffc0a0', head: '#ffd0b8', neckColor: '#ffb090', legColor: '#ff8a5a', wing: '#ffa070', bill: '#2b2020', legH: 10, neck: 10, bodySize: [8, 7, 11] }),
  salamander: () => critter({ color: '#ffb81e', belly: '#ff7a1a', headSize: [9.6, 5, 8], bodySize: [8, 5, 11], eye: [2.2, 2.6], eyeGap: 0.9, eyeAt: 0.9, tail: 'long', spikes: 3, spikeColor: '#ff5a1a', mouth: '#7a3a08' }),
  griffin: () => critter({ color: '#d8a030', head: '#fff4d8', beak: '#ffb81e', ears: 'tuft', earColor: '#fff4d8', wings: 'spread', wingColor: '#ffd24a', membrane: '#fff0c0', tail: 'long', legs: 1.8, legColor: '#ffb81e', headSize: [8, 6.4, 7], bodySize: [9, 7.4, 8] }),
  minotaur: () => critter({ color: '#a86a24', head: '#7a4a18', belly: '#e0b070', ears: 'horns', earColor: '#ffd24a', snout: '#f2c890', legs: 3, legColor: '#5a3410', footColor: '#ffd24a', bodySize: [10.4, 8.6, 7.6], headSize: [9.4, 6.6, 7.6], brow: '#3a2008' }),
  gecko: () => critter({ color: '#d8c43a', belly: '#fff0a0', headSize: [10, 5, 7.4], bodySize: [7, 4.6, 10], eye: [3, 3.2], eyeGap: 0.9, eyeAt: 0.8, pupil: '#7a4a08', tail: 'long', tailColor: '#c8a820', mouth: '#7a6a10' }),
  turtle: () => decorated({ color: '#ffe680', head: '#ffe680', belly: '#fff4c0', legs: 1.8, legColor: '#e8c84a', bodySize: [8, 5, 8], headSize: [7, 5.6, 6.4], eye: [2.2, 2.6] }, (g, p) => shell(g, p, '#d4a020', '#ffc832')),
  crocodile: () => critter({ color: '#b89420', head: '#c8a428', belly: '#fff0a8', headSize: [9, 4.6, 12], bodySize: [10, 5.4, 11], eye: [2.2, 2.6], eyeGap: 1.1, eyeAt: 1, fangs: true, spikes: 3, spikeColor: '#ffc832', mouth: '#5a4408', tail: 'long' }),
  goldfish: () => fish({ color: '#ffa81e', belly: '#fff0b0', finColor: '#ffd84a', mouth: '#a85808' }),
  trex,

  // Diamond
  arcticHare: () => critter({ color: '#f2f8ff', ears: 'long', inner: '#b8dcff', snout: '#d8ecff', tail: 'fan', eye: [2.4, 2.8], pupil: '#3a6ea8', bodySize: [8, 6.4, 7.4] }),
  snowCat: () => critter({ color: '#f8fbff', belly: '#d4ecff', ears: 'pointy', inner: '#a8dcff', snout: '#e8f4ff', tail: 'long', eye: [2.6, 3], pupil: '#2a8ad8', bodySize: [8, 6.8, 7.4], headSize: [10, 6.4, 7.2], fangs: true }),
  puffin: () => critter({ color: '#1c2a44', belly: '#f4f8ff', mask: '#f4f8ff', beak: '#ff8a3c', wings: 'fin', legs: 1.2, legColor: '#ff8a3c', eye: [2.2, 2.6], bodySize: [9, 8, 8] }),
  frostDog: () => critter({ color: '#7ce0f0', belly: '#e0faff', ears: 'pointy', earColor: '#4cc0dc', snout: '#e0faff', tail: 'fluff', tailColor: '#b4f0ff', legs: 1.8, legColor: '#4cc0dc', bodySize: [9, 7, 8], headSize: [9, 6.4, 7.4] }),
  snowyOwl: () => critter({ color: '#f4f8ff', belly: '#dceaf8', ears: 'tuft', beak: '#3a4458', wings: 'fin', wingColor: '#c8dcf0', eye: [3, 3.4], eyeRing: '#ffe05a', bodySize: [9.6, 7.5, 8], headSize: [10, 6.4, 7.6] }),
  arcticFox: () => critter({ color: '#e8f4ff', belly: '#ffffff', ears: 'pointy', inner: '#b4dcff', snout: '#ffffff', tail: 'fluff', tailColor: '#ffffff', headSize: [10, 6.6, 7.4], bodySize: [8.6, 7, 7.4], pupil: '#2a6ab8' }),
  swan: () => stilts({ color: '#fbfdff', wing: '#e0ecf8', bill: '#ff9a3c', legColor: '#2b3040', legH: 1.8, neck: 12, bodySize: [10, 8, 14] }),
  reindeer: () => decorated({ color: '#b8c4d8', belly: '#eaf2ff', head: '#c8d4e4', ears: 'round', snout: '#8ee0ff', legs: 3, legColor: '#7a8aa8', bodySize: [9, 7.4, 9], headSize: [7.6, 6.2, 7] }, (g, p) => antlers(g, p, '#a8ecff')),
  yak: () => decorated({ color: '#dcecff', head: '#a8c8e8', ears: 'horns', earColor: '#f4fbff', snout: '#7a9ac0', legs: 2, legColor: '#a8c8e8', bodySize: [12, 9, 10], headSize: [8.4, 6, 7] }, (g, p) => box(g, [13, 5, 10.6], [0, p.legs + 2, 0], '#f4fbff')),
  seal: () => critter({ color: '#9ab8d4', belly: '#dcecf8', snout: '#dcecf8', wings: 'fin', eye: [3, 3.4], tail: 'fan', headSize: [8.4, 6, 7], bodySize: [9, 7, 12] }),
  walrus: () => decorated({ color: '#a89888', belly: '#d8ccc0', snout: '#e8dcd0', wings: 'fin', eye: [2, 2.4], bodySize: [11, 8, 12], headSize: [10, 6.4, 7.6] }, (g, p) => tusks(g, p, '#f4fbff')),
  diamondSeal: () => decorated({ color: '#7ce8ff', belly: '#e8fcff', snout: '#e8fcff', wings: 'fin', tail: 'fan', eye: [3, 3.4], headSize: [8.4, 6, 7], bodySize: [9, 7, 12] }, (g, p) => crystals(g, p, '#c8f8ff', '#3fc8f0')),
  polarBear: () => critter({ color: '#fbfdff', belly: '#e4eef8', ears: 'round', snout: '#d4e2f0', legs: 1.4, legColor: '#dce8f4', bodySize: [11, 8.6, 9], headSize: [9.4, 6.6, 7.6] }),
  mammoth: () => decorated({ color: '#7a9ab8', head: '#6a88a8', ears: 'big', earColor: '#5a7898', legs: 3, legColor: '#4a6888', bodySize: [12, 10, 10], headSize: [10, 7, 7.4], eye: [2.2, 2.6] }, (g, p) => {
    trunk(g, p, '#5a7898')
    tusks(g, p, '#f4fbff')
    box(g, [13, 5, 10.8], [0, p.legs + 3, 0], '#8eb4d4')
  }),
  iceWolf: () => decorated({ color: '#a8c8e8', belly: '#eaf4ff', ears: 'pointy', earColor: '#6a9ac8', snout: '#eaf4ff', fangs: true, tail: 'fluff', tailColor: '#7ce8ff', legs: 2.2, legColor: '#6a9ac8', eyeRing: '#3fc8f0', bodySize: [9, 7, 8.4], headSize: [9.4, 6.6, 7.6] }, (g, p) => backSpikes(g, p, '#7ce8ff')),
  crab,
  crystalLizard: () => decorated({ color: '#5cc8e8', belly: '#d8f8ff', eye: [2.6, 3], eyeGap: 0.9, eyeAt: 0.84, tail: 'long', headSize: [9.4, 5, 8], bodySize: [8, 5, 11] }, (g, p) => crystals(g, p, '#b4f4ff', '#ffffff')),
  crystalSpider: () => bug({ color: '#7ce8ff', head: '#3fa8d8', legColor: '#b4f4ff', pair: 4, spots: [[-2.4, 7.4, -1], [2.4, 7.4, -4]], spotColor: '#f0ffff', eyeRing: '#f0ffff' }),
  narwhal: () => swimmer({ color: '#8ca8c8', fin: '#6a88a8', belly: '#eaf2fa', horn: '#f4fbff' }),
  whale: () => swimmer({ color: '#2e5f9e', fin: '#264f86', belly: '#d4dcec' }),

  // Radioactive
  mutantRat: () => critter({ color: '#6ad43a', belly: '#c8ff6a', ears: 'big', earColor: '#3fae2a', inner: '#ff7ac8', snout: '#c8ff6a', fangs: true, tail: 'long', tailColor: '#ff7ac8', eyeRing: '#eaff3c', bodySize: [9, 6.4, 9], headSize: [8.6, 6, 7] }),
  cockroach: () => bug({ color: '#5a3a1e', head: '#3a2410', wings: '#7ae83c', legColor: '#2b1a0c', eyeRing: '#c8ff3c' }),
  glowWorm: worm,
  pufferfish: () => fish({ color: '#b4e83c', belly: '#f4ffc0', finColor: '#7ac82a', spikes: '#eaff6a', size: [12, 12, 12], mouth: '#3a7a10' }),
  glowMoth: () => flutter({ wing: '#b8ff5a', wing2: '#7ae83c', dot: '#2b4a10', body: '#4a6a2a', head: '#c8ff6a' }),
  firefly: () => bug({ color: '#2b3a2a', head: '#1c2a1c', wings: '#a4c8a0', glow: '#d4ff3c', legColor: '#1c2a1c', eyeRing: '#eaff6a' }),
  skunk: () => decorated({ color: '#1e2a1e', belly: '#c8ff5a', ears: 'round', snout: '#c8ff5a', tail: 'fluff', tailColor: '#c8ff5a', bodySize: [9, 7, 8], headSize: [9, 6.2, 7.2] }, (g, p) => box(g, [2.6, 0.6, p.bd + 0.4], [0, p.legs + p.bh + p.hh + 0.1, 0], '#c8ff5a', { plain: true })),
  hyena: () => critter({ color: '#a8c040', belly: '#e0f090', ears: 'round', earColor: '#5a7020', snout: '#3a4a18', fangs: true, mouth: '#2a3a10', tail: 'fluff', tailColor: '#5a7020', legs: 2.4, legColor: '#5a7020', bodySize: [9, 7.4, 8.4], headSize: [9, 6.4, 7.4] }),
  vulture: () => critter({ color: '#3a4a2a', head: '#ff8a7a', belly: '#c8e878', beak: '#eaff6a', wings: 'spread', wingColor: '#2b3a1e', membrane: '#7ae83c', legs: 1.4, legColor: '#c8e878', headSize: [6.4, 5.4, 6], bodySize: [8.6, 7.4, 7.6] }),
  viper: () => coil({ color: '#5ae03a', band: '#1e3a14', head: '#7af04a', tongue: '#ff3a5a', fangs: true, pupil: '#ff3a3a' }),
  scorpion: () => bug({ color: '#3a7a1e', head: '#2a5a14', legColor: '#2a5a14', sting: '#c8ff3c', eyeRing: '#c8ff3c', yaw: 0.45 }),
  gorilla: () => critter({ color: '#2f4a2a', head: '#263c22', belly: '#7ae83c', mask: '#9ae85a', ears: 'round', snout: '#6ac03a', brow: '#14240f', legs: 1.6, legColor: '#1e3018', bodySize: [13, 9, 9], headSize: [8.6, 6.4, 7.4] }),
  rhino: () => decorated({ color: '#7a9a6a', belly: '#b8d4a0', ears: 'pointy', snout: '#b8d4a0', legs: 2.6, legColor: '#4a6a3a', bodySize: [12, 8.4, 10], headSize: [8.6, 6.4, 8.4], eye: [2, 2.4] }, (g, p) => {
    box(g, [2.4, 6.4, 2.4], [0, p.mid + 1.4, p.front + 1], '#d4ff3c', { taper: [0.1, 1] })
    box(g, [1.6, 3, 1.6], [0, p.top + 0.8, 1.6], '#d4ff3c', { taper: [0.1, 1] })
  }),
  hippo: () => critter({ color: '#8a7ab8', head: '#7a6aa8', belly: '#c8ff6a', ears: 'round', snout: '#d8c8f0', mouth: '#3a2a5a', fangs: true, eye: [2, 2.4], eyeAt: 0.84, legs: 1.8, legColor: '#5a4a88', bodySize: [12, 8, 10], headSize: [11, 6.4, 8.4] }),
  radioactiveDragon: () => critter({ color: '#3ae04a', belly: '#d4ff3c', ears: 'horns', earColor: '#d4ff3c', wings: 'spread', wingColor: '#1e8a2a', membrane: '#b8ff3c', snout: '#7af05a', fangs: true, spikes: 3, spikeColor: '#d4ff3c', headSize: [9.6, 6.6, 8], eyeRing: '#eaff6a' }),
  axolotl: () => decorated({ color: '#ff9acb', belly: '#ffd4e8', headSize: [11, 5.6, 8], bodySize: [7.6, 5, 9], eye: [2, 2.4], eyeGap: 1.4, mouth: '#a83a78', tail: 'fan', tailColor: '#7ae83c' }, (g, p) => {
    for (const side of [-1, 1]) for (const y of [0, 2, 4]) box(g, [3.6, 1, 1], [side * (p.hw / 2 + 1.4), p.mid - 2 + y, 0], '#7ae83c', { rot: [0, 0, side * (0.5 - y * 0.25)], plain: true })
  }),
  radioactivePufferfish: () => fish({ color: '#7af03a', belly: '#eaff6a', finColor: '#ff7a3c', spikes: '#ff7a3c', size: [12, 12, 12], eyeRing: '#eaff6a', mouth: '#1e6a14' }),
  piranha: () => fish({ color: '#6a8a5a', belly: '#ff5a4a', finColor: '#3a6a2a', teeth: true, mouth: '#2a0a0a', eyeRing: '#c8ff3c', size: [7, 12, 13] }),
  shark: () => swimmer({ color: '#5a7a68', fin: '#465e50', belly: '#d4ffb4', dorsal: true, teeth: true }),
  anglerfish: () => fish({ color: '#2b2a44', belly: '#4a4a6a', finColor: '#1e1d32', teeth: true, mouth: '#0a0a14', lure: '#d4ff3c', size: [10, 11, 12], eyeRing: '#d4ff3c' }),

  // Rainbow
  butterfly: () => flutter({ wing: '#ff5ac8', wing2: '#4dbbff', dot: '#ffe14d', body: '#2b2040' }),
  ladybug: () => bug({ color: '#ff3a3a', head: '#1c1820', spots: [[-3, 7.8, 0], [3, 7.8, -1], [-2.4, 6.6, -5.4], [3, 6.8, -5]], spotColor: '#1c1820' }),
  bee: () => bug({ color: '#ffd21e', head: '#2b2228', bands: '#2b2228', wings: '#d8f0ff' }),
  peacock: () => decorated({ color: '#2a5fc8', belly: '#3fd0ff', beak: '#ffc02e', ears: 'tuft', earColor: '#4de37a', legs: 1.2, legColor: '#a88a5a', eye: [2.2, 2.6], headSize: [6.6, 5.4, 6], bodySize: [8, 7, 7.4] }, (g) => {
    box(g, [20, 19, 1.6], [0, 11, -5.2], '#2fc97a', { taper: [1.1, 0.46] })
    for (const [x, y] of [[-6.4, 16], [0, 18], [6.4, 16], [-3.4, 11], [3.4, 11]]) {
      box(g, [3.4, 3.4, 0.4], [x, y, -4.2], '#ffd24a', { plain: true })
      box(g, [1.8, 1.8, 0.4], [x, y, -3.9], '#2a5fc8', { plain: true })
    }
  }),
  chameleon: () => critter({ color: '#4de37a', head: '#ff9a1f', belly: '#ffe14d', headSize: [9, 6, 7.6], bodySize: [8, 6.6, 10], eye: [3.2, 3.4], eyeGap: 0.7, eyeRing: '#ff4d6d', spikes: 3, spikeColor: '#4dbbff', tail: 'long', tailColor: '#a56dff', legs: 1.6, legColor: '#4dbbff' }),
  hummingbird: () => critter({ color: '#3fd0ff', head: '#ff4d9d', belly: '#ffe14d', beak: '#2b2228', wings: 'spread', wingColor: '#a56dff', membrane: '#4de37a', tail: 'fan', tailColor: '#ff9a1f', headSize: [6.4, 5.4, 5.8], bodySize: [6.4, 6.4, 6] }),
  unicorn: () => decorated({ color: '#fff4fb', ears: 'pointy', inner: '#ffb4dc', snout: '#ffd8ec', legs: 3.2, legColor: '#ffd8ec', tail: 'fan', tailColor: '#a56dff', bodySize: [9, 7.4, 9.6], headSize: [7, 7, 7.4] }, (g, p) => {
    horn(g, p, '#ffd24a', 7)
    ;['#ff4d6d', '#ffe14d', '#4de37a', '#4dbbff'].forEach((c, i) => box(g, [2.4, 3, 1.4], [0, p.top - 2.4 - i * 2.2 + 3, -p.hd / 2 - 0.2 + i * -0.3], c))
  }),
  kangaroo: () => stilts({ color: '#ff9a5a', head: '#ffb07a', legColor: '#d8743a', ears: true, four: true, legH: 4, neck: 4, bodySize: [9, 11, 8], crown: '#ff5a9e', wing: '#4dbbff' }),
  llama: () => stilts({ color: '#ffd8f0', head: '#fff0fa', neckColor: '#c8b0ff', legColor: '#7ad8ff', ears: true, four: true, legH: 7, neck: 10, bodySize: [9, 7.4, 11], crown: '#ffe14d' }),
  elephant: () => decorated({ color: '#a88cf0', head: '#9a7ce8', ears: 'big', earColor: '#ff7ac8', inner: '#ffb4dc', legs: 3, legColor: '#7a5cc8', bodySize: [12, 10, 10], headSize: [10, 7, 7.4], eye: [2.2, 2.6] }, (g, p) => {
    trunk(g, p, '#8a6ce0')
    tusks(g, p, '#ffe14d')
  }),
  giraffe: () => stilts({ color: '#ffc24a', neckColor: '#ffc24a', head: '#ffd06a', legColor: '#ff9a3c', ears: true, four: true, legH: 10, neck: 14, bodySize: [8, 7, 10], patch: '#ff5a9e', patches: [[4.4, 15, 0], [4.4, 13, -4], [-4.4, 14, -2], [1.6, 20, 4.4], [-1.6, 26, 4.4]], crown: '#a56dff' }),
  zebra: () => decorated({ color: '#fbfbff', ears: 'pointy', snout: '#2b2840', legs: 3.2, legColor: '#a56dff', tail: 'fan', tailColor: '#4dbbff', bodySize: [9, 7.4, 9.6], headSize: [7, 7, 7.4] }, (g, p) => {
    stripes(g, p, '#ff4d9d')
    box(g, [2.4, p.hh + 3, 2.8], [0, p.mid + 0.6, -p.hd / 2 + 0.2], '#4dbbff')
  }),
  hydra,
  chimera: () => decorated({ color: '#ff7a3c', head: '#ffc83a', belly: '#ffe89a', ears: 'horns', earColor: '#4dbbff', snout: '#fff0c8', wings: 'bat', wingColor: '#7a3ad8', membrane: '#c86dff', fangs: true, tail: 'long', tailColor: '#4de37a', legs: 1.6, legColor: '#d8541c', headSize: [9.4, 6.6, 7.4], bodySize: [9, 7, 7.6] }, (g, p) => mane(g, p, '#ff4d6d')),
  kitsune: () => decorated({ color: '#fff0f8', belly: '#ffe0f0', ears: 'pointy', earColor: '#ff5a9e', inner: '#ffd24a', snout: '#ffffff', eyeRing: '#a56dff', headSize: [10, 6.6, 7.4], bodySize: [8.6, 7, 7.4] }, (g, p) => {
    ;[['#ff4d6d', -7], ['#ffe14d', -3.6], ['#4de37a', 0], ['#4dbbff', 3.6], ['#a56dff', 7]].forEach(([c, x]) => box(g, [3, 11, 3], [x, 9, -p.bd / 2 - 2], c, { rot: [-0.3, 0, x * -0.08], taper: [0.3, 0.8] }))
  }),
  starfish,
  octopus,
  seahorse,
  dolphin: () => swimmer({ color: '#5a9cff', fin: '#a56dff', belly: '#ffd8f0', dorsal: true }),
  leviathan: () => coil({ color: '#7a3ad8', band: '#3fd0ff', head: '#ff4d9d', rings: [[18, 3.6], [15, 3.6], [13, 3.6], [11, 3.6], [9, 3.6]], fangs: true, tongue: '#ffe14d', glow: '#ffe14d' }),
}

// --- Eggs -------------------------------------------------------------------------------
const BOX = new BoxGeometry(1, 1, 1)
const m4 = new Matrix4()
const tint = new Color()

// Voxel egg. paint(x, y, z) (each -1..1, y up) returns a colour; only the shell is built.
function egg(paint, { bumps = [], extras } = {}) {
  const g = new Group()
  const H = 24
  const R = H * 0.46
  const cells = []
  const inside = (x, y, z) => {
    const t = (y + 0.5) / H - 0.5
    const r = R * Math.pow(Math.max(0, 1 - 4 * t * t), 0.42) * (1 - 0.28 * t)
    if (r > 2.5 && x * x + z * z <= r * r) return true
    return bumps.some(([bx, by, bz, br]) => (x - bx) ** 2 + (y - by) ** 2 + (z - bz) ** 2 <= br * br)
  }
  const span = Math.ceil(R * 1.3)
  for (let y = -3; y < H + 3; y++) {
    for (let z = -span; z <= span; z++) {
      for (let x = -span; x <= span; x++) {
        if (!inside(x, y, z)) continue
        const shell = !inside(x + 1, y, z) || !inside(x - 1, y, z) || !inside(x, y + 1, z) || !inside(x, y - 1, z) || !inside(x, y, z + 1) || !inside(x, y, z - 1)
        if (shell) cells.push([x, y, z])
      }
    }
  }
  // Studs on every other voxel only: the reference's marks are coarser than its voxels.
  for (const parity of [0, 1]) {
    const part = cells.filter(([x, y, z]) => (x + y + z + 300) % 2 === parity)
    const mesh = new InstancedMesh(BOX, material('#ffffff', parity === 1), part.length)
    part.forEach(([x, y, z], i) => {
      mesh.setMatrixAt(i, m4.makeTranslation(x, y, z))
      mesh.setColorAt(i, tint.set(paint(x / R, (y / H) * 2 - 1, z / R, x, y, z)))
    })
    g.add(mesh)
  }
  extras?.(g)
  return g
}

const shade = (a, b) => (x, y, z, ix, iy, iz) => ((ix + iy + iz) % 2 ? a : b)
const near = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1

function batPaint(x, y, z, ix, iy, iz) {
  if (z > 0.1) {
    for (const side of [-1, 1]) {
      if (near(x, y, side * 0.44, 0.22, 0.27, 0.19)) return near(x, y, side * 0.42, 0.2, 0.13, 0.1) ? '#101018' : '#fff'
    }
    if (Math.abs(x) < 0.26 && y > -0.08 && y < 0.1) return Math.abs(x) > 0.08 && Math.abs(x) < 0.17 && Math.abs(y) < 0.04 ? '#c75c9d' : '#ff9ccc'
    if (Math.abs(x) < 0.5 && y > -0.2 && y < -0.13) return '#2a1a66'
    if (near(x, y, 0, -0.5, 0.6, 0.27)) return '#ff72c8'
  }
  return (ix + iy + iz) % 2 ? '#6242e0' : '#4f33c4'
}

const batEars = (g) => {
  for (const side of [-1, 1]) {
    box(g, [4, 5, 4], [side * 12.5, 14, 0], '#4f33c4', { taper: [0.3, 1], rot: [0, 0, side * -0.9] })
    box(g, [2.6, 3.4, 4.2], [side * 12.5, 13.4, 0.3], '#ff72c8', { taper: [0.3, 1], rot: [0, 0, side * -0.9], plain: true })
  }
}

const EGGS = {
  basicEgg: () => egg(shade('#fbe8df', '#f6ddd2')),
  batEgg: () => egg(batPaint, { extras: batEars }),
  cloudEgg: () => egg(shade('#dcd6ff', '#c9c0ff'), { bumps: [[-6, 24, 1, 6], [6, 25, 0, 5.4], [0, 27, -1, 6], [-10, 17, 0, 5]] }),
  jungleEgg: () => egg((x, y, z, ix, iy) => (((ix + 40) % 9 < 4) !== ((iy + 40) % 8 < 4) ? '#3aa63a' : '#7a4a24')),
  lavaEgg: () => egg((x, y, z, ix, iy, iz) => (Math.abs(Math.sin(ix * 0.7 + iy * 0.5) + Math.cos(iz * 0.6 + iy * 0.4)) < 0.28 ? '#ff8a1f' : '#3a2a30')),
  toxicEgg: () => egg((x, y) => (y + Math.sin(x * 9) * 0.18 > 0.25 ? '#93ee3c' : '#3a2f4a')),
  secretEgg: () => egg((x, y) => ['#ff4d6d', '#ff9a1f', '#ffe14d', '#4de37a', '#4dbbff', '#a56dff'][Math.floor((y + 1) * 3 + x * 0.4 + 6) % 6]),
}

// A pet's model for the game world (the plot), on the same studded materials as its picture.
export function buildPet(id) {
  studs ??= studTexture()
  return PETS[id]()
}

// --- Rendering --------------------------------------------------------------------------
const art = new Map() // id -> { color, shadow } data URLs
const queue = [...Object.keys(PETS).map((id) => ({ id, pet: true })), ...Object.keys(EGGS).map((id) => ({ id, pet: false }))]
let gl = null
let scene = null
let camera = null
let shadowCanvas = null
let started = false

function setup() {
  gl = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  gl.setPixelRatio(1)
  gl.setSize(SIZE, SIZE, false)
  gl.outputColorSpace = SRGBColorSpace
  gl.setClearColor(0x000000, 0)
  scene = new Scene()
  scene.add(new HemisphereLight('#ffffff', '#c6c6d2', 2.5))
  const sun = new DirectionalLight('#ffffff', 1.1)
  sun.position.set(6, 8, 10)
  scene.add(sun)
  camera = new PerspectiveCamera(20, 1, 1, 400)
  studs = studTexture()
  shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = shadowCanvas.height = SIZE
}

function teardown() {
  for (const m of mats.values()) m.dispose()
  mats.clear()
  studs.dispose()
  gl.dispose()
  gl.forceContextLoss()
  gl = scene = camera = shadowCanvas = null
}

const bounds = new Box3()
const size = new Vector3()
const middle = new Vector3()
const BAR = 0.215 // share of a card's height under its name bar
function render({ id, pet }) {
  const model = (pet ? PETS : EGGS)[id]()
  model.rotation.y = model.userData.yaw ?? (pet ? 0.4 : 0.22) // turned so the right side shows, as in the reference
  scene.add(model)
  model.updateMatrixWorld(true)
  bounds.setFromObject(model)
  bounds.getSize(size)
  bounds.getCenter(middle)
  // Pets start under the name bar and run off the card's bottom and sides; eggs just fit.
  const view = pet ? Math.max(size.x, size.y) * (model.userData.fit ?? 1.12) : Math.max(size.x, size.y) * 1.03
  if (pet) middle.y = bounds.max.y - view * (0.5 - BAR)
  const dist = view / 2 / Math.tan((camera.fov * Math.PI) / 360)
  camera.position.set(middle.x, middle.y + dist * 0.05, middle.z + dist)
  camera.lookAt(middle)
  gl.render(scene, camera)
  scene.remove(model)
  model.traverse((o) => {
    if (o.geometry && o.geometry !== BOX) o.geometry.dispose()
    if (o.isInstancedMesh) o.dispose()
    if (o.material?.isMeshBasicMaterial) o.material.dispose()
  })

  const ctx = shadowCanvas.getContext('2d')
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(gl.domElement, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, SIZE, SIZE)
  art.set(id, { color: gl.domElement.toDataURL(), shadow: shadowCanvas.toDataURL() })
}

// Draws every picture, once; fn(id, art) for the ones done, then as each of the rest is ready.
const listeners = new Set()
export function renderArt(fn) {
  for (const [id, a] of art) fn(id, a)
  if (!queue.length) return
  listeners.add(fn)
  if (started) return
  started = true
  setup()
  const pump = () => {
    const job = queue.shift()
    render(job)
    for (const l of listeners) l(job.id, art.get(job.id))
    if (queue.length) requestAnimationFrame(pump)
    else teardown()
  }
  requestAnimationFrame(pump)
}

// Every id in the config has a model, so a new pet can't silently show an empty card.
if (import.meta.env.DEV) {
  for (const egg of INDEX.eggs) {
    if (!EGGS[egg.id]) console.warn(`petArt: no model for ${egg.id}`)
    for (const p of egg.pets) if (!PETS[p.id]) console.warn(`petArt: no model for ${p.id}`)
  }
  for (const p of PLAYTIME.pets) if (!PETS[p.id]) console.warn(`petArt: no model for ${p.id}`)
}
