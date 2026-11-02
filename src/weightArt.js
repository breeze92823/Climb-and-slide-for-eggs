import { DirectionalLight, HemisphereLight, Mesh, MeshLambertMaterial, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { WEIGHTS } from './config.js'
import { speckle, voxelGeometry } from './voxel.js'

// The weights of the Treadmill Shop, as voxel models. Long axis on X, the player's grip at the
// origin. The same geometry is lifted, lies on the pad and is rendered once for the shop's card.
const U = 0.07 // m per voxel
const E = 1.3 // x of the ends of a dumbbell
const odd = (n) => Math.abs(n) % 2 === 1
const spin = (y, z, n) => Math.floor(((Math.atan2(z, y) + Math.PI) / Math.PI) * n)

// A cylinder along X. Its box's corners are carved, so it goes after what lies inside it.
const disc = (x, half, r, color) => ['b', x - half, -r, -r, x + half, r, r, (a, b, c) => (b * b + c * c > r * r ? null : typeof color === 'function' ? color(a, b, c) : color)]
const rod = (color, r = 0.11) => ['b', -E, -r, -r, E, r, r, color]
const stripes = (a, b, width = 0.2) => (x) => (odd(Math.floor(x / width)) ? a : b)
const ends = (fn) => [...fn(-E, -1), ...fn(E, 1)]
const dots = (colors, seed, size = 2) => speckle(U * size, colors, seed)

function dumbbell() {
  const tread = (x, y, z) => (Math.hypot(y, z) < 0.6 ? '#70757b' : odd(spin(y, z, 7)) ? '#3e4146' : '#585c62')
  return [rod(stripes('#e6eaee', '#b9c2ca')), ...ends((x) => [disc(x, 0.34, 0.78, tread), disc(x, 0.38, 0.26, '#a3acb3')])]
}

function sphere() {
  return [rod(stripes('#c6dcea', '#9ebad0')), ...ends((x) => [['e', x, 0, 0, 0.84, 0.84, 0.84, dots(['#48617c', '#566f8c', '#3f566e', '#5f7a98'], 4, 3)]])]
}

function strawberry() {
  const flesh = dots(['#e8202c', '#d81824', '#f02c34', '#e8202c', '#d81824', '#ffd84a'], 5)
  const leaf = dots(['#1ea83c', '#148c30', '#2cc048'], 6)
  return [rod((x) => (Math.abs(x) > 0.5 ? '#1ea83c' : '#e8202c')), ...ends((x, s) => [['e', x + s * 0.1, 0, 0, 0.74, 0.8, 0.8, flesh], disc(x - s * 0.58, 0.16, 0.6, leaf)])]
}

function royal() {
  const gold = dots(['#ffcf3a', '#f0b828', '#ffdc5c'], 7)
  return [rod(stripes('#ffdc5c', '#f0b828')), ...ends((x, s) => [disc(x, 0.42, 0.72, gold), disc(x - 0.46, 0.08, 0.8, '#7a2ad0'), disc(x + 0.46, 0.08, 0.8, '#7a2ad0'), disc(x + s * 0.54, 0.06, 0.3, '#ffe88a')])]
}

function watermelon() {
  const rind = (x, y, z) => {
    const r = Math.hypot(x - Math.sign(x) * E, y, z)
    if (r < 0.58) return dots(['#f4384c', '#f4384c', '#f4384c', '#f4384c', '#1c1c1c'], 8, 1.5)(x, y, z)
    if (r < 0.68) return '#f6f4d8'
    return odd(spin(y, z, 6)) ? '#1d8a30' : '#2eb54a'
  }
  return [rod('#2eb54a'), ...ends((x, s) => [['e', x, 0, 0, 0.82, 0.82, 0.82, rind], ['b', x + s * 0.38, -1, -1, x + s * 0.9, 1, 1, () => null]])]
}

function lava() {
  return [rod(stripes('#ff8a1f', '#3a2a30')), ...ends((x) => [['e', x, 0, 0, 0.82, 0.82, 0.82, dots(['#2a2226', '#352a2c', '#2a2226', '#3e3032', '#ff6a1a', '#ffb52a'], 9)]])]
}

function crystal() {
  const gem = dots(['#7cf0ff', '#a8f8ff', '#b488ff', '#5cd8f4'], 10)
  return [rod(stripes('#c8a8ff', '#8a5cf0')), ...ends((x) => [['b', x - 0.95, -0.95, -0.95, x + 0.95, 0.95, 0.95, (a, b, c) => (Math.abs(a - x) * 1.05 + Math.abs(b) * 0.8 + Math.abs(c) * 0.8 > 0.92 ? null : gem(a, b, c))]])]
}

function pancake() {
  return [
    rod(stripes('#a8ecff', '#6cd0f4', 0.14)),
    ...ends((x, s) => [
      ...[-3, -2, -1, 0, 1, 2, 3].map((i) => disc(x + i * 0.13, 0.07, 0.76 - Math.abs(i) * 0.012, odd(i) ? '#7a2a16' : '#f4b84e')),
      ['b', x + s * 0.46, -0.24, -0.24, x + s * 0.6, 0.24, 0.24, '#c8ee40'],
    ]),
  ]
}

function frozen() {
  const ice = dots(['#1c9ae8', '#22a8f4', '#1a8cdc'], 11)
  return [rod('#2ab4f0'), ...ends((x) => [['b', x - 0.6, -0.84, -0.84, x + 0.6, 0.84, 0.84, ice], ['b', x - 0.26, -0.3, -0.86, x + 0.2, 0.26, 0.86, '#3fd8a8'], ['b', x - 0.1, -0.1, -0.88, x + 0.32, 0.4, 0.88, '#62e8ff']])]
}

function rocket() {
  const shape = (x, y, z) => {
    const r = Math.hypot(y, z)
    if (x > 1) return r < 0.52 * (2.1 - x) ? '#ffd23a' : null
    if (x > -1.7) {
      if (r >= 0.52) return Math.abs(y) < 0.07 && x < -0.9 ? (Math.abs(z) < 0.52 + (-0.9 - x) * 0.55 ? '#e8363c' : null) : Math.abs(z) < 0.07 && x < -0.9 && Math.abs(y) < 0.52 + (-0.9 - x) * 0.55 ? '#e8363c' : null
      return Math.hypot(x - 0.3, y - 0.05) < 0.26 && z > 0 ? '#52c8ff' : x > 0.8 || (x < -1.4 && x > -1.5) ? '#e8363c' : '#f2f6fa'
    }
    if (r > 0.42 * (x + 2.55)) return null
    return dots(['#ff8a1f', '#ffd23a', '#3a7cff', '#ff4a20'], 12)(x, y, z)
  }
  return [['b', -2.55, -1.05, -1.05, 2.1, 1.05, 1.05, shape]]
}

function anvil() {
  const dark = dots(['#3a3f46', '#32363c', '#42484f'], 13)
  return [rod(stripes('#9aa3aa', '#6d7278')), ...ends((x) => [['b', x - 0.5, 0.3, -0.72, x + 0.5, 0.72, 0.72, dark], ['b', x - 0.26, -0.3, -0.34, x + 0.26, 0.3, 0.34, dark], ['b', x - 0.46, -0.72, -0.54, x + 0.46, -0.3, 0.54, dark], ['b', x - 0.5, 0.66, -0.72, x + 0.5, 0.74, 0.72, '#6d7884']])]
}

function golden() {
  const gold = dots(['#ffd21e', '#f4b414', '#ffe45c', '#ffd21e'], 14)
  return [rod(stripes('#fff0a0', '#ffd21e')), ...ends((x, s) => [disc(x - s * 0.34, 0.18, 0.9, gold), disc(x, 0.18, 0.74, gold), disc(x + s * 0.34, 0.18, 0.56, gold), disc(x + s * 0.5, 0.06, 0.26, '#ffffff')])]
}

function donut() {
  const sprinkles = dots(['#ff7ab8', '#ff7ab8', '#ff7ab8', '#ff7ab8', '#ffffff', '#ffe05a', '#5cd8ff'], 15)
  return [
    rod(stripes('#ffd0e4', '#ffffff')),
    ...ends((x, s) => [
      ['b', x - 0.46, -0.98, -0.98, x + 0.46, 0.98, 0.98, (a, b, c) => {
        const d = Math.hypot(Math.hypot(b, c) - 0.56, a - x)
        if (d > 0.42) return null
        return (a - x) * s > -0.08 ? sprinkles(a, b, c) : '#d89a50'
      }],
    ]),
  ]
}

function cake() {
  const icing = (a, b, c) => (odd(spin(b, c, 8)) ? '#ff5ca8' : '#ffffff')
  const blue = dots(['#7cd8ff', '#a8ecff', '#ffffff'], 16)
  return [
    rod(stripes('#ff5ca8', '#7cd8ff', 0.16)),
    ...ends((x, s) => [disc(x - s * 0.42, 0.24, 0.88, icing), disc(x, 0.2, 0.68, blue), disc(x + s * 0.36, 0.16, 0.46, icing), ['b', x + s * 0.5, -0.06, -0.06, x + s * 0.8, 0.06, 0.06, '#ffe05a']]),
  ]
}

function car() {
  const wheel = (cx, z0, z1) => ['b', cx - 0.62, -0.05, z0, cx + 0.62, 1.2, z1, (x, y) => {
    const r = Math.hypot(x - cx, y - 0.55)
    return r > 0.6 ? null : r < 0.24 ? '#b8c0c8' : odd(spin(x - cx, y - 0.55, 8)) && r > 0.5 ? '#16161c' : '#2c2c34'
  }]
  const red = dots(['#e8202c', '#d81c26', '#f02c34'], 17, 3)
  return [
    ...[-1.25, 1.25].flatMap((cx) => [wheel(cx, -1.2, -0.84), wheel(cx, 0.84, 1.2)]),
    ['b', -2, 0.72, -0.84, 2, 1.42, 0.84, red],
    ['b', -1.05, 1.42, -0.8, 0.85, 2.2, 0.8, red],
    ['b', -0.9, 1.54, -0.84, -0.14, 2.06, 0.84, '#a8ecff'],
    ['b', 0.02, 1.54, -0.84, 0.72, 2.06, 0.84, '#a8ecff'],
    ['b', 0.7, 1.54, -0.66, 0.88, 2.06, 0.66, '#a8ecff'],
    ['b', 1.96, 0.86, -0.7, 2.04, 1.34, 0.7, '#f4f4f4'],
    ['b', 1.96, 1.04, 0.4, 2.08, 1.3, 0.72, '#ffc21f'],
    ['b', 1.96, 1.04, -0.72, 2.08, 1.3, -0.4, '#ffc21f'],
    ['b', -2.08, 0.66, -0.9, 2.08, 0.82, 0.9, '#f4f4f4'],
  ]
}

function plane() {
  const skin = (x, y, z) => {
    const nose = x > 2.2 ? Math.sqrt(Math.max(0, 1 - ((x - 2.2) / 0.8) ** 2)) : 1
    const tail = x < -1.6 ? Math.max(0.3, 1 + (x + 1.6) * 0.45) : 1
    const r = 0.6 * nose * tail
    if (Math.hypot(y, z) > r) return null
    if (y < -0.14) return '#1c5ce0'
    if (y > 0.05 && y < 0.3 && x > -1.6 && x < 2.1 && odd(Math.floor((x + 3) / 0.32))) return x > 2 ? '#2a3a50' : '#7cc8f4'
    return '#f6f8fa'
  }
  const wing = (x, y, z) => (Math.abs(x + Math.abs(z) * 0.55) < 0.62 - Math.abs(z) * 0.16 ? (Math.abs(z) > 2.3 ? '#1c5ce0' : '#e8ecf2') : null)
  const fin = (x, y) => (x + y * 0.8 > -2.2 && x < -1.7 + y * -0.6 + 0.5 ? (y > 1 ? '#f6f8fa' : '#1c5ce0') : null)
  return [
    ['b', -2.9, -0.2, -2.7, 1, -0.06, 2.7, wing],
    ['b', -3, -0.5, -1.3, 0.6, -0.2, 1.3, (x, y, z) => (Math.abs(Math.abs(z) - 1.15) < 0.2 && x > -0.75 && x < 0.3 ? '#2a3a50' : null)],
    ['b', -3, 0.3, -0.08, -1.5, 1.6, 0.08, fin],
    ['b', -3, -0.62, -0.62, 3.02, 0.62, 0.62, skin],
    ['b', -3, 0.1, -1.1, -2.3, 0.2, 1.1, '#1c5ce0'],
  ]
}

// tilt: how the shop's card leans it. up: m the model is raised so the hands reach it.
const MODELS = {
  dumbbell: { shapes: dumbbell },
  sphere: { shapes: sphere },
  strawberry: { shapes: strawberry },
  royal: { shapes: royal },
  watermelon: { shapes: watermelon },
  lava: { shapes: lava },
  crystal: { shapes: crystal },
  pancake: { shapes: pancake },
  frozen: { shapes: frozen },
  rocket: { shapes: rocket, up: 0.5 },
  anvil: { shapes: anvil },
  golden: { shapes: golden },
  donut: { shapes: donut },
  cake: { shapes: cake },
  car: { shapes: car, tilt: 0.3 },
  plane: { shapes: plane, unit: 0.08, up: 0.62 },
}

const built = new Map()
export function weightGeometry(id) {
  if (!built.has(id)) {
    const m = MODELS[id]
    const g = voxelGeometry(m.shapes(), m.unit ?? U)
    if (m.up) g.translate(0, m.up, 0)
    g.computeBoundingBox()
    built.set(id, g)
  }
  return built.get(id)
}

// --- Rendering ---------------------------------------------------------------------------
// One picture per weight for the cards, on a throwaway WebGL context (as petArt.js does).
const SIZE = 420
const art = new Map()
let started = false

function shoot(gl, scene, camera, material, id) {
  const geometry = weightGeometry(id)
  const mesh = new Mesh(geometry, material)
  mesh.rotation.set(0.3, -0.42, MODELS[id].tilt ?? 0.82)
  scene.add(mesh)
  const box = geometry.boundingBox
  const reach = Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y) * 0.5
  camera.position.set(0, 0, reach / Math.tan((camera.fov * Math.PI) / 360))
  gl.render(scene, camera)
  scene.remove(mesh)
  art.set(id, gl.domElement.toDataURL())
}

// Draws every picture, once; fn(id, url) as each is ready.
export function renderWeights(fn) {
  for (const [id, url] of art) fn(id, url)
  if (started) return
  started = true
  const gl = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  gl.setPixelRatio(1)
  gl.setSize(SIZE, SIZE, false)
  gl.outputColorSpace = SRGBColorSpace
  gl.setClearColor(0x000000, 0)
  const scene = new Scene()
  scene.add(new HemisphereLight('#ffffff', '#c6c6d2', 2.5))
  const sun = new DirectionalLight('#ffffff', 1.1)
  sun.position.set(6, 8, 10)
  scene.add(sun)
  const camera = new PerspectiveCamera(20, 1, 1, 400)
  const material = new MeshLambertMaterial({ vertexColors: true })
  const queue = WEIGHTS.list.map((w) => w.id)
  const pump = () => {
    const id = queue.shift()
    shoot(gl, scene, camera, material, id)
    fn(id, art.get(id))
    if (queue.length) return requestAnimationFrame(pump)
    material.dispose()
    gl.dispose()
    gl.forceContextLoss()
  }
  requestAnimationFrame(pump)
}

// Every weight in the config has a model, so a new one can't silently show an empty card.
if (import.meta.env.DEV) {
  for (const w of WEIGHTS.list) if (!MODELS[w.id]) console.warn(`weightArt: no model for ${w.id}`)
}
