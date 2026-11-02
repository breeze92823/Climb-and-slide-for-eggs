import { BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'
import { CLIMB, climbY, LOBBY, RUN } from './config.js'
import { label, fontReady, std } from './propkit.js'
import { RAPIER, addFixed } from './physics.js'
import { paintSign, paintSlideWater, paintStoneStuds, paintTurf, toTexture } from './textures.js'
import { Blocks, speckle, voxelGeometry } from './voxel.js'

// The way out of the arena: stairs and a water slide side by side, running north up
// a ridge. `s` is metres north of the wall; `y(s)` the height of the climb there.
const { north: N, gap } = LOBBY
const { length: L, slope, ridge, bank, water, stairs, colors } = CLIMB
const zAt = (s) => N - s
const y = (s) => climbY(zAt(s))
const pitch = Math.atan(slope)
const slopeLen = Math.hypot(1, slope)

// Height of the hillside (a shallow V either side of the climb).
export function hillY(x, z) {
  const off = Math.max(0, Math.abs(x) - 4.2)
  return climbY(z) + off * bank
}

// A strip of ground along the climb from x0 to x1, optionally tilting up by bankRate.
function strip(x0, x1, s0, s1, lift0, lift1, tile, color) {
  const g = new BufferGeometry()
  const p = [x0, y(s0) + lift0, zAt(s0), x1, y(s0) + lift1, zAt(s0), x1, y(s1) + lift1, zAt(s1), x0, y(s1) + lift0, zAt(s1)]
  g.setAttribute('position', new Float32BufferAttribute(p, 3))
  g.setAttribute('uv', new Float32BufferAttribute([x0 / tile, s0 / tile, x1 / tile, s0 / tile, x1 / tile, s1 / tile, x0 / tile, s1 / tile], 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.computeVertexNormals()
  const m = new Mesh(g, color)
  m.receiveShadow = true
  return m
}

function buildStairs(scene) {
  const [x0, x1] = stairs
  const rise = CLIMB.tread * slope
  const n = Math.floor(L / CLIMB.tread)
  const pos = []
  const nor = []
  const col = []
  const uv = []
  const idx = []
  const stone = new Color(colors.stone)
  const stoneDark = new Color(colors.stoneDark)
  const nose = new Color(colors.nose)
  const slopeNormal = [0, Math.cos(pitch), Math.sin(pitch)]
  const quad = (corners, normal, shade, uvs) => {
    const start = pos.length / 3
    corners.forEach((c, i) => {
      pos.push(...c)
      nor.push(...normal)
      col.push(shade.r, shade.g, shade.b)
      uv.push(...uvs[i])
    })
    idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }
  for (let i = 0; i < n; i++) {
    const s0 = i * CLIMB.tread
    const s1 = s0 + CLIMB.tread
    const top = (i + 0.5) * rise // the ramp collider runs through the middle of each step
    const low = top - rise
    const band = Math.floor(i / 12) % 2 === 0 ? stone : stoneDark
    // The first few steps have the pale nosing, the rest are plain studs. Both faces
    // shade as the slope: seen from the floor the risers are all that shows of the
    // upper stairs, and lit as vertical faces in the wall's shade they would go dark.
    const riser = i < 9 ? nose : band
    quad([[x0, low, zAt(s0)], [x1, low, zAt(s0)], [x1, top, zAt(s0)], [x0, top, zAt(s0)]], slopeNormal, riser, [[x0, s0], [x1, s0], [x1, s0 + 0.25], [x0, s0 + 0.25]])
    quad([[x0, top, zAt(s0)], [x1, top, zAt(s0)], [x1, top, zAt(s1)], [x0, top, zAt(s1)]], slopeNormal, band, [[x0, s0], [x1, s0], [x1, s1], [x0, s1]])
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  const mesh = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, map: toTexture(paintStoneStuds(), { repeat: 1 / 1.1, srgb: true, anisotropy: 16 }), roughness: 0.8 }))
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  scene.add(mesh)
}

// The grey "?" stone: flat for the tablets either side of a gate, full depth for the
// mystery egg carried up the climb.
export function lockStone(depth = 0.17) {
  const unit = 0.075
  const grey = speckle(unit, ['#8d9ba2', '#7f8d95', '#98a6ac'], 5)
  const mark = '#59656c'
  const z = depth + 0.13
  return voxelGeometry([
    ['e', 0, 0.6, 0, 0.5, 0.62, depth, grey],
    ['b', -0.17, 0.92, -z, 0.17, 1.0, z, mark],
    ['b', 0.1, 0.72, -z, 0.2, 1.0, z, mark],
    ['b', -0.04, 0.6, -z, 0.2, 0.72, z, mark],
    ['b', -0.04, 0.46, -z, 0.06, 0.6, z, mark],
    ['b', -0.04, 0.26, -z, 0.06, 0.38, z, mark],
  ], unit)
}

export function buildClimb(scene, particles, tree) {
  buildStairs(scene)

  // --- Hillside ---
  const turf = toTexture(paintTurf(), { srgb: true, anisotropy: 8 })
  const hillMat = (color) => new MeshStandardMaterial({ map: turf, color, roughness: 1 })
  const left = hillMat(colors.bankLeft)
  const right = hillMat(colors.bankRight)
  const edgeLift = (ridge - 4.2) * bank
  scene.add(
    strip(-ridge - 6, -4.2, 0.05, L, edgeLift * (1 + 6 / (ridge - 4.2)), 0, 9, left),
    strip(4.2, ridge + 6, 0.05, L, 0, edgeLift * (1 + 6 / (ridge - 4.2)), 9, right),
    strip(-4.2, 4.2, 0.05, L, -0.5, -0.5, 9, left), // under the stairs and slide
  )

  // Pale slabs lying on the banks, and the darker gullies between them.
  const blocks = new Blocks()
  const slabs = [[-6.2, 7, 3.4, 0.7], [-7.5, 15, 4.6, 0.9], [-8.4, 26, 6, 1], [-6.8, 40, 5.2, 0.8], [7.2, 9, 4, 0.7], [8.8, 22, 5.4, 0.8], [6.4, 34, 3.6, 0.7]]
  for (const [x, s, len, w] of slabs) {
    blocks.box(w, 0.12, len, x, hillY(x, zAt(s)) + 0.1, zAt(s), colors.bankStrip, [pitch, Math.sign(x) * 0.5, 0])
  }

  // --- Rails, divider, the lip the slide runs out onto ---
  const longBox = (x, width, height, lift, color, s0 = -0.1, s1 = L) => {
    const mid = (s0 + s1) / 2
    blocks.box(width, height, (s1 - s0) * slopeLen, x, y(mid) + lift, zAt(mid), color, [pitch, 0, 0])
  }
  longBox(water[0] - 0.25, 0.5, 0.42, 0.14, colors.rim)
  longBox(0, 0.22, 0.34, 0.12, colors.divider)
  longBox(stairs[1] + 0.26, 0.52, 0.6, 0.24, colors.rail)
  blocks.box(9.2, 0.14, 1.4, 0.05, 0.07, N + 0.5, colors.lip)
  blocks.box(water[1] - water[0], 0.06, 0.26, (water[0] + water[1]) / 2, y(2.9) + 0.2, zAt(2.9), colors.lip, [pitch, 0, 0])

  // --- The gates, one per checkpoint on the climb ---
  const [gx0, gx1] = stairs
  const gcx = (gx0 + gx1) / 2 + 0.1
  const stone = lockStone()
  const gates = RUN.tiers.map((tier) => ({ tier, s: tier.m / RUN.metresPerS })).filter((g) => g.s < L - 8)
  for (const { s } of gates) {
    const gy = y(s)
    const gateZ = zAt(s)
    blocks.box(0.34, 3.4, 0.5, gx0 + 0.05, gy + 1.5, gateZ, colors.gate)
    blocks.box(0.34, 3.4, 0.5, gx1 + 0.3, gy + 1.5, gateZ, colors.gate)
    blocks.box(gx1 - gx0 + 0.85, 1.05, 0.62, gcx, gy + 3.1, gateZ, colors.gate)
    blocks.box(gx1 - gx0 + 0.5, 0.6, 0.1, gcx, gy + 3.08, gateZ + 0.33, colors.gateDark)
    const stoneS = s + 3
    blocks.add(stone, gx0 - 0.1, y(stoneS) + 1.1, zAt(stoneS), 0, 1)
    blocks.add(stone, gx1 + 0.3, y(stoneS) + 1.1, zAt(stoneS), 0, 1)
  }

  // --- Summit block ---
  blocks.box(9.2, 1, 12, 0.05, y(L) - 0.45, zAt(L + 5.5), colors.lip)

  scene.add(blocks.mesh(std('#ffffff', { vertexColors: true, roughness: 0.75 })))

  for (const { tier, s } of gates) {
    const sign = paintSign(`${tier.name}  •  x${tier.luck} Luck`, { board: colors.gateDark, border: null, color: '#ffffff', outline: '#3a454a', font: '700 72px Fredoka, "Arial Black", sans-serif', w: 768, h: 128 })
    const signTex = new CanvasTexture(sign.canvas)
    signTex.colorSpace = SRGBColorSpace
    fontReady.then(() => {
      sign.draw()
      signTex.needsUpdate = true
    })
    const signMesh = new Mesh(new PlaneGeometry(gx1 - gx0 + 0.46, 0.56), new MeshBasicMaterial({ map: signTex }))
    signMesh.position.set(gcx, y(s) + 3.08, zAt(s) + 0.39)
    scene.add(signMesh)
  }

  // --- Your-best marker: stands at the player's best metres, hidden until there is one ---
  const poleBlocks = new Blocks()
  poleBlocks.box(0.08, 1.5, 0.08, 0, 0.75, 0, '#ffd23a')
  const pole = poleBlocks.mesh(new MeshBasicMaterial({ vertexColors: true }), false)
  pole.visible = false
  scene.add(pole)
  let best = null
  const setBest = (metres) => {
    if (best) {
      scene.remove(best)
      best.material.map.dispose()
      best.material.dispose()
    }
    const s = Math.min(metres / RUN.metresPerS, L)
    pole.visible = metres > 0
    pole.position.set(stairs[1] - 0.2, y(s), zAt(s))
    best = label([[['YOUR BEST', '#ffc400']], [[`${Math.floor(metres)}m`, '#ffffff']]], 1, { bg: '#16161c', outline: '#000000', outlineWidth: 6, font: '800 56px Fredoka, "Arial Black", sans-serif', pad: 12 })
    best.visible = metres > 0
    best.position.set(stairs[1] - 0.2, y(s) + 2, zAt(s))
    scene.add(best)
  }

  // --- Slide water: unlit so it stays bright in the wall's shade, scrolled downhill ---
  const waterTex = toTexture(paintSlideWater(colors.water), { srgb: true, anisotropy: 16 })
  waterTex.wrapS = waterTex.wrapT = RepeatWrapping
  const waterWidth = water[1] - water[0]
  const waterLen = (L + 0.2) * slopeLen
  waterTex.repeat.set(waterWidth / CLIMB.waterTile, waterLen / CLIMB.waterTile)
  const sheet = new Mesh(new PlaneGeometry(waterWidth, waterLen), new MeshBasicMaterial({ map: waterTex }))
  sheet.rotation.x = -Math.PI / 2 + pitch
  sheet.position.set((water[0] + water[1]) / 2, y(L / 2) + 0.16, zAt(L / 2))
  scene.add(sheet)

  // The cyan pools either side of the foot of the climb, in the gap of the wall.
  const poolMat = new MeshBasicMaterial({ color: colors.pool })
  for (const sign2 of [-1, 1]) {
    const pool = new Mesh(new PlaneGeometry(gap - 4.2, 4), poolMat)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(sign2 * (gap + 4.2) / 2, 0.03, N - 1.2)
    scene.add(pool)
  }

  // --- Spray where the water lands, mist further up ---
  const mx = (water[0] + water[1]) / 2
  particles.add({ count: 36, pos: [mx, 0.25, N + 0.5], spread: [1.6, 0.05, 0.3], vel: [0, 1.5, 0.7], jitter: [0.7, 0.7, 0.5], gravity: -6, life: 0.8, size: 0.13, color: '#ffffff', color2: '#9ff4ff' })
  particles.add({ layer: 'glow', count: 8, pos: [mx, 0.4, N + 0.6], spread: [1.6, 0.15, 0.4], vel: [0, 0.4, 0.2], jitter: [0.2, 0.2, 0.2], life: 1.1, size: 0.5, color: '#8fd8e8' })
  particles.add({ count: 34, pos: [mx, y(18) + 0.5, zAt(18)], spread: [1.5, 8, 15], vel: [0, 0.2, 0.9], jitter: [0.2, 0.1, 0.3], life: 1.4, size: 0.13, color: '#ffffff' })

  // --- The forest: planted on the banks, clear of the climb ---
  for (let s = 18; s < L; s += CLIMB.forestStep) {
    for (const side of [-1, 1]) {
      for (let x = CLIMB.forestEdge; x < ridge + 2; x += CLIMB.forestStep) {
        const r = Math.abs(Math.sin(s * 12.9898 + x * 78.233 + side) * 43758.5453) % 1
        if (r < 0.1) continue
        const px = side * (x + r * 1.6)
        const pz = zAt(s + r * 1.8)
        tree(px, hillY(px, pz) - 0.1, pz, 0.55 + r * 0.35)
      }
    }
  }
  return {
    setBest,
    update(elapsed) {
      waterTex.offset.y = elapsed * CLIMB.scroll
    },
  }
}

// Collision: one hillside surface (flat through the climb, tilting up on the banks),
// fences down its sides, and a wall at the summit.
export function climbColliders() {
  const xsLine = [-ridge - 1, -4.2, 4.2, ridge + 1]
  const lift = (x) => Math.max(0, Math.abs(x) - 4.2) * bank
  const verts = []
  for (const s of [0, L + 11]) for (const x of xsLine) verts.push(x, y(Math.min(s, L)) + lift(x), zAt(s))
  const index = [0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6]
  addFixed(RAPIER.ColliderDesc.trimesh(new Float32Array(verts), new Uint32Array(index)), { x: 0, y: 0, z: 0 })

  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pitch)
  const hz = (L * slopeLen) / 2 + 6
  for (const sign of [-1, 1]) {
    const x = sign * (ridge + 0.5)
    addFixed(RAPIER.ColliderDesc.cuboid(0.5, 7, hz), { x, y: y(L / 2) + lift(x) + 3, z: zAt(L / 2) }, q)
  }
  addFixed(RAPIER.ColliderDesc.cuboid(ridge + 1, 8, 1), { x: 0, y: y(L) + 6, z: zAt(L + 12) })
}
