import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three'
import { LOBBY, STANDS } from './config.js'
import { fontReady, label, neon, solidBox, solidPole, std } from './propkit.js'
import { paintAura, paintPawCoin, paintSign } from './textures.js'
import { glowDecal, lightCurtain } from './fx.js'
import { Blocks } from './voxel.js'
import { buildLeaderboards } from './leaderboardBoards.js'
import { coinHeap, jellyfish, petModel, portalHorn, trexEgg } from './pets.js'

// The set pieces along the walls: the shop and sell stalls, the T-Rex eggs, the secret
// jellyfish, the world portal, the free gifts, the paw coin and the two blue boards.
// Static parts go in the shared `b` (Blocks); moving ones are their own meshes, ticked
// by the update() this returns. Every place that lights its surroundings has a small
// point light (off on Low, see setLights) over a painted glow that is always on.

const WOOD = '#8f3b1c'
const WOOD_LIGHT = '#a84a24'
const canvasTexture = (canvas) => {
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

// A sign whose text changes (goals.js): a set(lines) that repaints only on a change.
function liveSign(scene, height, opts, x, y, z) {
  let sprite = null
  let shown = ''
  return (lines) => {
    const key = JSON.stringify(lines)
    if (key === shown) return
    shown = key
    if (sprite) {
      scene.remove(sprite)
      sprite.material.map.dispose()
      sprite.material.dispose()
    }
    sprite = label(lines, height, opts)
    sprite.position.set(x, y, z)
    scene.add(sprite)
  }
}

const signs = { badges: {} } // what goals.js repaints

function signBoard(text, opts, w, h) {
  const painted = paintSign(text, opts)
  const tex = canvasTexture(painted.canvas)
  fontReady.then(() => {
    painted.draw()
    tex.needsUpdate = true
  })
  return new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: tex }))
}

// The market stall both the shop and the sell stand are built on.
function stall(b, roof, trim, stripe) {
  b.box(7, 0.12, 4.6, 0, 0.06, 0, '#ee9a38')
  for (const x of [-2.7, 2.7]) {
    for (const z of [-1.5, 1.5]) {
      b.box(0.34, 3, 0.34, x, 1.6, z, WOOD_LIGHT)
      b.box(0.5, 0.3, 0.5, x, 0.27, z, WOOD)
    }
  }
  b.box(5.6, 2.7, 0.14, 0, 1.55, -1.5, '#9c4524') // back wall
  b.box(6, 0.16, 0.2, 0, 1.25, 1.6, WOOD_LIGHT) // rail
  b.box(0.16, 0.16, 3.2, -2.9, 1.25, 0, WOOD_LIGHT)
  b.box(0.16, 0.16, 3.2, 2.9, 1.25, 0, WOOD_LIGHT)
  b.box(3.6, 0.5, 1.1, 0, 0.92, 1.1, '#8a3417') // the tub of the counter
  b.box(2.7, 0.4, 0.9, 0, 0.5, 1.1, '#7a2c12')

  // Two roof slopes meeting on a ridge, with white stripes, and a valance across the front.
  for (const m of [-1, 1]) {
    b.box(3.5, 0.16, 4.3, m * 1.62, 3.48, 0, roof, [0, 0, -m * 0.2])
    b.box(0.5, 0.06, 4.32, m * 1.25, 3.64, 0, stripe, [0, 0, -m * 0.2])
    b.box(0.5, 0.06, 4.32, m * 2.75, 3.4, 0, stripe, [0, 0, -m * 0.2])
  }
  b.box(2.6, 0.5, 0.1, 0, 3.32, 2.14, trim)
}

const K = STANDS.stallScale

function shop(scene, b) {
  const { x, z } = STANDS.shop
  b.at(x, 0, z, 0, K)
  stall(b, '#2f8ef5', '#1f74dc', '#ffffff')
  // The giant blue sneaker on the roof.
  const blue = '#35a8ff'
  const paleBlue = '#62c4ff'
  b.at(x + 0.9 * K, 3.6 * K, z, -0.15, K)
  b.box(3.6, 0.32, 1.8, 0, 0.26, 0, '#ffffff')
  b.box(3.4, 0.1, 1.84, 0, 0.42, 0, '#d8e4ee')
  b.box(1.7, 1.5, 1.6, 0.8, 1.2, 0, blue)
  b.box(1.9, 0.5, 1.7, 0.8, 2.1, 0, paleBlue)
  b.box(1.5, 0.7, 1.5, -0.3, 0.8, 0, blue)
  b.box(1.1, 0.5, 1.4, -1.1, 0.68, 0, paleBlue)
  b.box(0.2, 1.2, 0.5, -0.1, 1.3, 0.76, '#ffffff')
  b.box(0.7, 0.16, 0.5, -0.5, 1.2, 0.76, '#ffffff')
  b.at(x, 0, z, 0, K)
  b.add(petModel('whiteCat').geometry, -0.1, 0.92, 1.1, 0, 1.5)
  b.at()
  const sign = signBoard('SHOP', { board: '#a4562a', border: '#6e3214', color: '#2fa8f6', outline: '#17608f' }, 2.6 * K, 0.98 * K)
  sign.position.set(x - 0.5 * K, 4.32 * K, z + 2.28 * K)
  sign.rotation.x = -0.1
  scene.add(sign)
  solidBox(3.1 * K, 2, 2 * K, x, 2, z)
}

function sell(scene, b) {
  const { x, z } = STANDS.sell
  b.at(x, 0, z, 0, K)
  stall(b, '#ee2028', '#c8101a', '#ffffff')
  // The shopkeeper: dark coat and a wide hat, leaning on the counter.
  b.box(1.5, 0.95, 0.6, 0, 1.45, 0.5, '#20262e')
  b.box(0.3, 0.8, 0.5, -0.9, 1.4, 0.6, '#d8dee4')
  b.box(0.3, 0.8, 0.5, 0.9, 1.4, 0.6, '#d8dee4')
  b.box(0.62, 0.58, 0.58, 0, 2.2, 0.5, '#efc090')
  b.box(0.5, 0.2, 0.05, 0, 2.2, 0.8, '#14141a')
  b.box(1, 0.1, 0.9, 0, 2.5, 0.5, '#14141a')
  b.box(0.6, 0.34, 0.6, 0, 2.7, 0.5, '#14141a')
  b.at()
  const sign = signBoard('SELL', { board: '#b0602e', border: '#6e3214', color: '#1a0c08', outline: null }, 2.5 * K, K)
  sign.position.set(x, 4.34 * K, z + 2.28 * K)
  sign.rotation.x = -0.1
  scene.add(sign)
  solidBox(3.1 * K, 2, 2 * K, x, 2, z)
}

function eggs(scene, b, particles, lights) {
  const { x, z } = STANDS.eggs
  const spread = 1.55 // eggs sit this far either side of the pad's centre
  const pad = new Mesh(new CylinderGeometry(2.2, 2.2, 0.12, 40), neon('#1a7cff', 1.1))
  pad.position.set(x, 0.07, z)
  const inner = new Mesh(new CylinderGeometry(1.7, 1.7, 0.14, 40), neon('#0d4fe0', 1))
  inner.position.set(x, 0.08, z)
  const rise = lightCurtain(3.4, 2.6, 1.1, '#1e8cff', 0.28)
  rise.position.set(x, 0.1, z)
  const pool = glowDecal(6.4, 5.4, '#2a90ff', 0.3)
  pool.rotation.x = -Math.PI / 2
  pool.position.set(x, 0.14, z)
  scene.add(pad, inner, rise, pool)

  const egg = trexEgg()
  b.add(egg, x - spread, 0.05, z + 0.3, 0.32, 0.72)
  b.add(egg, x + spread, 0.05, z + 0.3, -0.32, 0.72)
  solidPole(0.6, 2, x - spread, z + 0.3)
  solidPole(0.6, 2, x + spread, z + 0.3)

  // The energy link between the eggs.
  const linkMat = neon('#e8f2c0', 2.6)
  const link = new Mesh(new CylinderGeometry(0.08, 0.08, spread * 1.5, 8), linkMat)
  link.rotation.z = Math.PI / 2
  link.position.set(x, 0.7, z + 0.3)
  const flareMat = new SpriteMaterial({ map: softTexture(), color: '#fff27a', blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false })
  const flare = new Sprite(flareMat)
  flare.scale.set(1, 0.7, 1)
  flare.position.set(x + 0.15, 0.72, z + 0.45)
  scene.add(link, flare)
  particles.add({ count: 46, pos: [x, 0.72, z + 0.34], spread: [0.9, 0.12, 0.15], vel: [0, 0.4, 0], jitter: [0.3, 0.5, 0.3], life: 0.9, size: 0.16, color: '#fff27a', color2: '#b8ff6a', boost: 1.3 })

  // Brown-orange wisps licking up the wall behind them.
  particles.add({ layer: 'smoke', count: 26, pos: [x, 1.3, LOBBY.north + 0.5], spread: [1.3, 0.6, 0.1], vel: [0, 0.8, 0], jitter: [0.2, 0.3, 0.05], life: 1.8, size: 0.7, color: '#a8541c', color2: '#6a3414' })
  particles.add({ count: 12, pos: [x, 1, LOBBY.north + 0.7], spread: [1.3, 0.6, 0.1], vel: [0, 1.2, 0], jitter: [0.2, 0.4, 0.1], life: 1.1, size: 0.14, color: '#ffaa40', boost: 1.3 })

  signs.pass = liveSign(scene, 0.9, { font: '700 54px Fredoka, "Arial Black", sans-serif', outlineWidth: 7 }, x + 1, 3.6, z + 0.2)
  const badge = label('1', 0.36, { bg: '#e0242c', outline: null, pad: 14, font: '700 64px Fredoka, sans-serif' })
  badge.position.set(x + 1, 4.3, z + 0.2)
  badge.visible = false
  signs.badges.pass = badge
  scene.add(badge)

  lights.push(pointLight(x, 1.4, z + 1.2, '#ffc66a', 7, 8))
  return (elapsed) => {
    const pulse = 0.65 + 0.25 * Math.sin(elapsed * 9) * Math.sin(elapsed * 3.1)
    flareMat.opacity = pulse
    flare.scale.set(0.8 + pulse * 0.5, 0.45 + pulse * 0.3, 1)
    rise.userData.material.opacity = 0.26 + 0.1 * Math.sin(elapsed * 2.2)
  }
}

let softDotTexture = null
function softTexture() {
  if (!softDotTexture) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.3, 'rgba(255,255,255,0.5)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    softDotTexture = canvasTexture(c)
  }
  return softDotTexture
}

function pointLight(x, y, z, color, intensity, distance) {
  const light = new PointLight(color, intensity, distance, 1.6)
  light.position.set(x, y, z)
  return light
}

function jellyfishStage(scene, particles, lights) {
  const { x, z } = STANDS.jellyfish
  const size = 5
  const frame = neon('#ffd400', 1.3)
  const bars = new Blocks()
  bars.box(size, 0.16, 0.5, 0, 0.1, size / 2 - 0.25, '#ffffff')
  bars.box(size, 0.16, 0.5, 0, 0.1, -size / 2 + 0.25, '#ffffff')
  bars.box(0.5, 0.16, size, size / 2 - 0.25, 0.1, 0, '#ffffff')
  bars.box(0.5, 0.16, size, -size / 2 + 0.25, 0.1, 0, '#ffffff')
  const rim = new Mesh(bars.geometry(), frame)
  rim.position.set(x, 0, z + 0.2)
  const fill = new Mesh(new PlaneGeometry(size - 1, size - 1), new MeshBasicMaterial({ color: '#ffee66', transparent: true, opacity: 0.4 }))
  fill.rotation.x = -Math.PI / 2
  fill.position.set(x, 0.05, z + 0.2)
  const curtain = lightCurtain(size, size, 0.9, '#ffd800', 0.5)
  curtain.position.set(x, 0.1, z + 0.2)
  scene.add(rim, fill, curtain)

  const body = new Mesh(jellyfish(), std('#ffffff', { vertexColors: true, roughness: 0.55, emissive: '#ff50c8', emissiveIntensity: 0.34 }))
  body.castShadow = true
  body.scale.setScalar(0.7)
  const pivot = new Group()
  pivot.position.set(x, 0.1, z + 0.4)
  pivot.add(body)
  scene.add(pivot)

  // The dark purple burst behind it: two soft blots turning against each other.
  const auraTex = canvasTexture(paintAura())
  const auraMat = (color, opacity) => new SpriteMaterial({ map: auraTex, color, blending: AdditiveBlending, transparent: true, opacity, depthWrite: false, fog: false })
  const auraA = new Sprite(auraMat('#6a24e0', 0.7))
  const auraB = new Sprite(auraMat('#9a40f0', 0.38))
  auraA.scale.set(5.4, 5.4, 1)
  auraB.scale.set(4, 4, 1)
  auraA.position.set(x, 1.8, z - 0.4)
  auraB.position.set(x, 1.8, z - 0.3)
  scene.add(auraA, auraB)
  particles.add({ layer: 'glow', count: 26, pos: [x, 1.9, z - 0.6], spread: [1.2, 1.3, 0.1], vel: [0, 0.2, 0], jitter: [0.4, 0.3, 0.05], life: 1.5, size: 0.7, color: '#6a28d8', color2: '#a048e8', radial: 0.7 })
  particles.add({ count: 24, pos: [x, 0.3, z + 0.2], spread: [2.4, 0.1, 2.4], vel: [0, 1, 0], jitter: [0.1, 0.5, 0.1], life: 1.3, size: 0.17, color: '#fff27a', boost: 1.4 })

  const sign = liveSign(scene, 2.5, { font: '800 64px Fredoka, "Arial Black", sans-serif', outline: '#2a1c10', outlineWidth: 8 }, x, 4.9, z)
  // The last line is the price.
  signs.jellyfish = (price) => sign([
    [['S', '#ffc83a'], ['E', '#8cf04a'], ['C', '#3ae0a0'], ['R', '#40c0ff'], ['E', '#b080ff'], ['T', '#ff70d8']],
    [['JELLYFISH', '#ffc66a']],
    [price],
  ])

  lights.push(pointLight(x, 2, z - 0.9, '#a040ff', 7, 8))
  return (elapsed) => {
    pivot.rotation.z = -0.32 + 0.12 * Math.sin(elapsed * 1.1)
    pivot.rotation.x = 0.1 * Math.sin(elapsed * 0.8)
    pivot.rotation.y = 0.3 * Math.sin(elapsed * 0.5)
    pivot.position.y = 0.22 + 0.16 * Math.sin(elapsed * 1.6)
    auraA.material.rotation = elapsed * 0.5
    auraB.material.rotation = -elapsed * 0.8
    curtain.userData.material.opacity = 0.4 + 0.14 * Math.sin(elapsed * 2.6)
  }
}

const portalFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float swirl = sin(a * 3.0 + r * 9.0 - uTime * 2.4) * 0.5 + 0.5;
    float ring = sin(r * 16.0 - uTime * 3.0) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.42, 0.1, 0.95), vec3(0.98, 0.45, 1.0), swirl * 0.55 + ring * 0.2);
    col = mix(col, vec3(1.0, 0.82, 1.0), smoothstep(0.75, 1.0, r) * 0.7);
    gl_FragColor = vec4(col, smoothstep(1.0, 0.92, r));
    #include <colorspace_fragment>
  }`
const portalVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

function portal(scene, b, particles, lights) {
  const { x, z } = STANDS.portal
  const main = portalHorn(1.25, 6.3, 0.5)
  const small = portalHorn(1.6, 3.8, 0.34)
  b.add(main, x - 1.25, 1.1, z, 0, 1) // the arch: two horns curving together
  b.add(main, x + 1.25, 1.1, z, Math.PI, 1)
  b.add(small, x - 1.5, 1.7, z, Math.PI, 1) // the smaller pair curling away
  b.add(small, x + 1.5, 1.7, z, 0, 1)
  for (const m of [-1, 1]) {
    b.at(x + m * 1.3, 0, z)
    b.box(1.5, 0.5, 1.3, 0, 0.26, 0.2, '#7f8690')
    b.box(1, 0.4, 1, 0, 0.7, 0.1, '#6e747e')
    b.box(0.9, 1.1, 0.9, 0, 1.4, 0, '#c8a070')
    b.box(0.76, 0.5, 0.76, 0, 2.1, 0, '#d9b488')
  }
  b.at()
  solidPole(0.75, 3, x - 1.3, z)
  solidPole(0.75, 3, x + 1.3, z)

  const swirl = new ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: portalVertex, fragmentShader: portalFragment, transparent: true, side: DoubleSide })
  const gate = new Mesh(new CircleGeometry(1, 40), swirl)
  gate.scale.set(0.8, 2.9, 1)
  gate.position.set(x, 3.7, z)
  scene.add(gate)
  particles.add({ count: 30, pos: [x, 2.2, z + 0.2], spread: [0.7, 2.2, 0.2], vel: [0, 0.8, 0.1], jitter: [0.2, 0.4, 0.2], life: 1.7, size: 0.16, color: '#e080ff', color2: '#9a40ff', boost: 1.4 })

  const title = label([[['Climb ', '#ffffff'], ['Green World', '#5cf07a']]], 0.5, { font: '700 64px Fredoka, "Arial Black", sans-serif' })
  title.position.set(x, 3.75, z + 1.2)
  const lock = liveSign(scene, 1.1, { bg: 'rgba(38,24,38,0.84)', font: '700 40px Fredoka, "Arial Black", sans-serif', outlineWidth: 5, pad: 14 }, x, 2.9, z + 1.2)
  const icon = eggIcon()
  icon.position.set(x, 3.08, z + 1.3)
  scene.add(title, icon)
  // The lock panel with its egg, or these lines once it is open.
  signs.portal = (lines) => {
    icon.visible = !lines
    lock(lines ?? [[['                ', '#ffffff']], [['Obtain ', '#ffffff'], ['T-Rex Egg', '#ff5454'], [' to Unlock', '#ffffff']]])
  }

  lights.push(pointLight(x, 3, z + 1.4, '#b050ff', 12, 9))
  return (elapsed) => {
    swirl.uniforms.uTime.value = elapsed
  }
}

// The little T-Rex egg in the lock panel.
function eggIcon() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#d4a650'
  ctx.beginPath()
  ctx.ellipse(64, 64, 44, 54, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#5a3a1a'
  ctx.stroke()
  ctx.fillStyle = '#f8f4ea'
  ctx.fillRect(32, 70, 64, 22)
  ctx.fillStyle = '#e8201e'
  ctx.fillRect(38, 76, 52, 8)
  ctx.fillStyle = '#16120c'
  ctx.fillRect(44, 46, 10, 10)
  ctx.fillRect(74, 46, 10, 10)
  const s = new Sprite(new SpriteMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false, fog: false }))
  s.scale.set(0.46, 0.46, 1)
  return s
}

function gift(b, w, h, x, z, yaw, box, ribbon) {
  b.at(x, 0, z, yaw)
  b.box(w, h, w, 0, h / 2 + 0.25, 0, box)
  b.box(w * 0.22, h + 0.02, w + 0.02, 0, h / 2 + 0.25, 0, ribbon)
  b.box(w + 0.02, h + 0.02, w * 0.22, 0, h / 2 + 0.25, 0, ribbon)
  b.box(w * 0.4, w * 0.24, w * 0.14, -w * 0.22, h + 0.44, 0, ribbon, [0, 0, 0.5])
  b.box(w * 0.4, w * 0.24, w * 0.14, w * 0.22, h + 0.44, 0, ribbon, [0, 0, -0.5])
}

function gifts(scene, b, particles, lights) {
  const { x, z } = STANDS.gifts
  b.at()
  b.add(coinHeap(7, 0.75, 4.6), x + 0.4, 0.02, z, 0, 1)
  gift(b, 2.1, 2.6, x + 0.2, z - 0.4, 0.5, '#ee1a22', '#ffc81e')
  gift(b, 1.5, 0.9, x + 0.3, z + 2.2, 0.2, '#e8181e', '#ffc81e')
  gift(b, 0.8, 0.8, x + 1.7, z - 1.2, 0.6, '#4aa8ff', '#f4f4ff')
  gift(b, 0.9, 0.9, x + 2.1, z + 0.9, 0.3, '#ff58b4', '#58d0ff')
  gift(b, 0.6, 0.6, x + 3, z - 0.3, 0.8, '#6ae04a', '#ffe64a')
  b.at()
  solidBox(2.2, 1.6, 3, x + 0.4, 1.6, z)

  signs.gift = liveSign(scene, 1.2, { font: '800 56px Fredoka, "Arial Black", sans-serif', outline: '#142a5a', outlineWidth: 8 }, x + 2.4, 2.6, z + 0.9)
  b.at(x + 2.4, 1.05, z + 0.9)
  b.box(0.42, 0.42, 0.34, 0, 0.3, 0, '#3e2a78')
  b.box(0.62, 0.1, 0.1, -0.44, 0.42, 0, '#2c1c58', [0, 0, 0.4])
  b.box(0.62, 0.1, 0.1, 0.44, 0.42, 0, '#2c1c58', [0, 0, -0.4])
  b.at()

  // The pile throws red-gold light onto the floor and up the wall behind it.
  const floorGlow = glowDecal(15, 12, '#ffb020', 0.85)
  floorGlow.rotation.x = -Math.PI / 2
  floorGlow.position.set(x + 2, 0.06, z)
  const wallGlow = glowDecal(11, 9, '#ff3010', 0.6)
  wallGlow.rotation.y = Math.PI / 2
  wallGlow.position.set(-LOBBY.halfWidth + 0.12, 1.8, z)
  scene.add(floorGlow, wallGlow)
  particles.add({ count: 40, pos: [x + 1, 1.4, z], spread: [2.6, 1.2, 2.6], vel: [0, 0.5, 0], jitter: [0.2, 0.3, 0.2], life: 1.6, size: 0.22, color: '#ffe05a', color2: '#ff5a30', boost: 1.5 })

  lights.push(pointLight(x + 3, 2.2, z, '#ff7a20', 30, 15))
  return (elapsed) => {
    floorGlow.material.opacity = 0.72 + 0.14 * Math.sin(elapsed * 2.1)
  }
}

function pawCoin(scene, particles) {
  const { x, z } = STANDS.paw
  const face = new MeshBasicMaterial({ map: canvasTexture(paintPawCoin()) })
  const edge = new MeshBasicMaterial({ color: '#ffffff' })
  const coin = new Mesh(new CylinderGeometry(1, 1, 0.16, 40), [edge, face, face])
  coin.rotation.x = Math.PI / 2
  const spin = new Group()
  spin.add(coin)
  spin.position.set(x, 1.5, z)
  spin.rotation.z = 0.2
  const pad = new Mesh(new CylinderGeometry(1.4, 1.4, 0.1, 32), neon('#25a0ff', 1.1))
  pad.position.set(x, 0.06, z)
  const glow = glowDecal(5, 5, '#2aa8ff', 0.6)
  glow.rotation.x = -Math.PI / 2
  glow.position.set(x, 0.13, z)
  const halo = lightCurtain(1.9, 1.9, 1.6, '#2a90ff', 0.28)
  halo.position.set(x, 0.1, z)
  scene.add(spin, pad, glow, halo)
  particles.add({ count: 18, pos: [x, 1.4, z], spread: [0.9, 1, 0.9], vel: [0, 0.4, 0], jitter: [0.2, 0.2, 0.2], life: 1.5, size: 0.17, color: '#a8e4ff', boost: 1.3 })
  signs.paw = liveSign(scene, 0.75, { font: '700 56px Fredoka, "Arial Black", sans-serif', outlineWidth: 7 }, x, 3.1, z)
  const badge = label('!', 0.34, { bg: '#e0242c', outline: null, pad: 14, font: '700 64px Fredoka, sans-serif' })
  badge.position.set(x, 3.6, z)
  badge.visible = false
  signs.badges.paw = badge
  scene.add(badge)
  return (elapsed) => {
    spin.rotation.y = elapsed * 1.2
  }
}

function boards(b) {
  for (const { x, z } of STANDS.panels) {
    b.at(x, 0, z, -Math.PI / 2)
    b.box(5.6, 0.34, 1.1, 0, 0.17, 0, '#46628e')
    b.box(5.2, 3.3, 0.3, 0, 2, 0, '#46628e', [-0.08, 0, 0])
    b.box(4.5, 2.6, 0.12, 0, 2, 0.17, '#8fb0d8', [-0.08, 0, 0])
    b.box(2.9, 0.6, 0.2, 0, 3.9, -0.14, '#8fb0d8', [-0.08, 0, 0])
    solidBox(0.7, 1.8, 2.8, x, 1.8, z)
  }
  b.at()
}

export function buildStands(scene, b, particles) {
  const lights = []
  shop(scene, b)
  sell(scene, b)
  boards(b)
  const tickers = [buildLeaderboards(scene, STANDS.panels).update, eggs(scene, b, particles, lights), jellyfishStage(scene, particles, lights), portal(scene, b, particles, lights), gifts(scene, b, particles, lights), pawCoin(scene, particles)]
  scene.add(...lights)
  return {
    signs,
    update(elapsed) {
      for (const tick of tickers) tick(elapsed)
    },
    setLights(on) {
      for (const light of lights) light.visible = on
    },
  }
}

export const propMaterial = () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 })
