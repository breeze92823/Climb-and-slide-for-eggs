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

function whale() {
  const g = new Group()
  box(g, [13, 9, 24], [0, 5.5, 0], '#2e5f9e', { taper: [0.9, 0.7] })
  box(g, [11, 3, 20], [0, 2.4, 1], '#d4dcec', { plain: true })
  box(g, [10, 6, 5], [0, 6.5, -13], '#264f86')
  box(g, [12, 1.4, 4], [0, 9.6, -15.5], '#264f86', { rot: [0.3, 0, 0] })
  for (const side of [-1, 1]) {
    box(g, [1.6, 4, 7], [side * 7.4, 3, 2], '#264f86', { rot: [0, 0, side * 0.5] })
    plate(g, [2.6, 2.6], [side * 6.52, 7.4, 8], '#ffffff')
    plate(g, [1.3, 1.3], [side * 6.54, 7.4, 8.05], '#10141e')
  }
  g.userData = { yaw: 0.9, fit: 1.02 }
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
  whale,
  lion,
  snail,
  ostrich,
  sphinx,
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
