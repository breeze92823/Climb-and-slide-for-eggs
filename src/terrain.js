import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { CLIMB, climbY, LOBBY } from './config.js'
import { solidBox } from './propkit.js'
import { RAPIER, addFixed } from './physics.js'
import { paintBaseplate, paintBrickCheck, toTexture } from './textures.js'
import { Blocks } from './voxel.js'

// The arena: a baseplate floor walled on all four sides, and stepped voxel terrain
// behind the walls. The terrain is a height field of square columns on one grid
// (arena edges and the climb's edges are grid lines): each column's top is green,
// its exposed sides are a green lip over purple brick. Bricks use world-space UVs,
// so every terrace shares the same two materials (two draw calls for all of it).

const { halfWidth: W, north: N, south: S, wallHeight, lip, gap, flankDepth, step } = LOBBY
const wallTop = wallHeight + lip
const INSIDE = -1 // the column is open: arena floor or the climb's hillside

// Smooth value noise, 0..1.
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function noise(x, y) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash(x0, y0)
  const b = hash(x0 + 1, y0)
  const c = hash(x0, y0 + 1)
  const d = hash(x0 + 1, y0 + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

// Terrace height at a point outside the arena.
function terraceHeight(x, z) {
  const out = Math.max(Math.abs(x) - W, z - S) // metres out past the E/W/S walls
  const n = noise(x * LOBBY.noise, z * LOBBY.noise)
  const wobble = noise(x * LOBBY.noise * 3 + 9, z * LOBBY.noise * 3)
  let h = wallTop
  if (out > 0) {
    const r = out - LOBBY.firstTerrace * (0.6 + 0.8 * wobble)
    // The hills stop level with the north wall: only sky shows over it.
    const south = Math.max(0, Math.min(1, (z - N + 30) / 34))
    if (r > 0) h += Math.min(r, 90) * LOBBY.rise * (0.45 + 1.1 * n) * south
  }
  if (z < N) {
    // The ridge the climb runs up, with the terraces stepping down either side of it.
    const s = N - z
    const along = s <= CLIMB.length ? s : CLIMB.length - (s - CLIMB.length) * 1.2
    const ridge = along * CLIMB.slope - Math.max(0, Math.abs(x) - CLIMB.ridge) * CLIMB.ridgeFall * (0.7 + 0.7 * wobble)
    h = Math.max(h, ridge)
  }
  return Math.min(LOBBY.maxHill + (z < N ? 80 : 0), wallTop + Math.round((h - wallTop) / step) * step)
}

function isOpen(x, z) {
  if (Math.abs(x) < W && z > N && z < S) return true // the arena
  const s = N - z
  if (s < 0 || s > CLIMB.length) return false
  if (Math.abs(x) < gap) return true
  return s > flankDepth && Math.abs(x) < CLIMB.ridge
}

// Grid lines: evenly spaced between the fixed lines, then outward from the outer ones.
function gridLines(fixed, cell, reach) {
  const lines = []
  for (let i = 0; i < fixed.length - 1; i++) {
    const n = Math.max(1, Math.round((fixed[i + 1] - fixed[i]) / cell))
    for (let k = 0; k < n; k++) lines.push(fixed[i] + ((fixed[i + 1] - fixed[i]) * k) / n)
  }
  const last = fixed[fixed.length - 1]
  lines.push(last)
  for (let d = cell; d <= reach; d += cell) lines.unshift(fixed[0] - d)
  for (let d = cell; d <= reach; d += cell) lines.push(last + d)
  return lines
}

class Quads {
  constructor() {
    this.pos = []
    this.nor = []
    this.uv = []
    this.idx = []
  }
  // Four corners counter-clockwise; uv given in metres per corner.
  add(corners, normal, uvs) {
    const start = this.pos.length / 3
    corners.forEach((c, i) => {
      this.pos.push(c[0], c[1], c[2])
      this.nor.push(normal[0], normal[1], normal[2])
      this.uv.push(uvs[i][0], uvs[i][1])
    })
    this.idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }
  geometry() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.idx)
    return g
  }
}

// One exposed side of a column, from y0 up to y1, running a -> b (seen from outside).
function wallFace(target, ax, az, bx, bz, y0, y1, normal) {
  const u0 = normal[0] !== 0 ? az : ax
  const u1 = normal[0] !== 0 ? bz : bx
  target.add([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], normal, [[u0, y0], [u1, y0], [u1, y1], [u0, y1]])
}

export function buildTerrain(scene) {
  const colors = LOBBY.colors
  const tile = 1 / LOBBY.brickTile
  const greenTex = toTexture(paintBrickCheck(colors.green[0], colors.green[1], colors.green[2]), { repeat: tile, srgb: true, anisotropy: 16 })
  const purpleTex = toTexture(paintBrickCheck(colors.purple[0], colors.purple[1], colors.purple[2]), { repeat: tile, srgb: true, anisotropy: 16 })

  // --- The floor ---
  const floorW = W * 2 + 8
  const floorD = S - N + 8
  const floorTex = toTexture(paintBaseplate(colors.floor), { srgb: true, anisotropy: 16 })
  floorTex.repeat.set(floorW / LOBBY.floorTile, floorD / LOBBY.floorTile)
  const floor = new Mesh(new PlaneGeometry(floorW, floorD), new MeshStandardMaterial({ map: floorTex, roughness: 0.62, metalness: 0 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.z = (N + S) / 2
  floor.receiveShadow = true
  scene.add(floor)

  // --- The terrain columns ---
  const xs = gridLines([-W, -CLIMB.ridge, -gap, gap, CLIMB.ridge, W], LOBBY.cell, LOBBY.reach)
  const zs = gridLines([N - CLIMB.length, N - flankDepth, N, S], LOBBY.cell, LOBBY.reach)
  const nx = xs.length - 1
  const nz = zs.length - 1
  const heights = new Float32Array(nx * nz)
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = (xs[i] + xs[i + 1]) / 2
      const z = (zs[j] + zs[j + 1]) / 2
      heights[i + j * nx] = isOpen(x, z) ? INSIDE : terraceHeight(x, z)
    }
  }
  const neighbour = (i, j) => {
    if (i < 0 || j < 0 || i >= nx || j >= nz) return -40
    const h = heights[i + j * nx]
    if (h !== INSIDE) return h
    const z = (zs[j] + zs[j + 1]) / 2
    return z < N ? Math.max(0, climbY(z) - 3) : 0 // sides dip under the hillside, reach the floor in the arena
  }
  const green = new Quads()
  const purple = new Quads()
  const side = (ax, az, bx, bz, h, below, normal) => {
    if (below >= h) return
    const lipBottom = Math.max(below, h - lip)
    wallFace(green, ax, az, bx, bz, lipBottom, h, normal)
    if (lipBottom > below) wallFace(purple, ax, az, bx, bz, below, lipBottom, normal)
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const h = heights[i + j * nx]
      if (h === INSIDE) continue
      const x0 = xs[i]
      const x1 = xs[i + 1]
      const z0 = zs[j]
      const z1 = zs[j + 1]
      green.add([[x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0]], [0, 1, 0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]])
      side(x1, z1, x1, z0, h, neighbour(i + 1, j), [1, 0, 0])
      side(x0, z0, x0, z1, h, neighbour(i - 1, j), [-1, 0, 0])
      side(x0, z1, x1, z1, h, neighbour(i, j + 1), [0, 0, 1])
      side(x1, z0, x0, z0, h, neighbour(i, j - 1), [0, 0, -1])
    }
  }
  const greenMesh = new Mesh(green.geometry(), new MeshStandardMaterial({ map: greenTex, roughness: 0.85 }))
  const purpleMesh = new Mesh(purple.geometry(), new MeshStandardMaterial({ map: purpleTex, roughness: 0.9 }))
  for (const m of [greenMesh, purpleMesh]) {
    m.receiveShadow = true
    m.frustumCulled = false
  }
  scene.add(greenMesh, purpleMesh)

  // --- The red stripe along the walls' feet + the pale line under the green lip ---
  const trim = new Blocks()
  const edges = [
    [-W, N, -gap, N, 0.05],
    [gap, N, W, N, 0.05],
    [-W, S, W, S, -0.05],
  ]
  for (const [ax, az, bx, bz, nudge] of edges) {
    const len = bx - ax
    trim.box(len, LOBBY.stripe, 0.08, (ax + bx) / 2, LOBBY.stripe / 2, az + nudge, colors.stripe)
    trim.box(len, 0.1, 0.06, (ax + bx) / 2, wallHeight + 0.05, az + nudge, colors.lipLine)
  }
  for (const sign of [-1, 1]) {
    trim.box(0.08, LOBBY.stripe, S - N, sign * (W - 0.05), LOBBY.stripe / 2, (N + S) / 2, colors.stripe)
    trim.box(0.06, 0.1, S - N, sign * (W - 0.05), wallHeight + 0.05, (N + S) / 2, colors.lipLine)
  }
  scene.add(trim.mesh(new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), false))

  return { heightAt: terrainHeightAt(xs, zs, heights, nx, nz) }
}

// y of the terrace top at a point (for planting trees); 0 inside the open areas.
function terrainHeightAt(xs, zs, heights, nx, nz) {
  const find = (lines, v) => {
    let lo = 0
    let hi = lines.length - 2
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (lines[mid] <= v) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  return (x, z) => {
    const h = heights[Math.min(nx - 1, find(xs, x)) + Math.min(nz - 1, find(zs, z)) * nx]
    return h === INSIDE ? 0 : h
  }
}

// Collision: the floor and thick walls, far taller than a jump. The climb adds its own.
export function terrainColliders() {
  const wallH = 30
  solidBox(W + 30, 2, (S - N) / 2 + 30, 0, -2, (N + S) / 2)
  addFixed(RAPIER.ColliderDesc.cuboid(2, wallH, (S - N) / 2 + flankDepth), { x: W + 2, y: wallH, z: (N + S) / 2 })
  addFixed(RAPIER.ColliderDesc.cuboid(2, wallH, (S - N) / 2 + flankDepth), { x: -W - 2, y: wallH, z: (N + S) / 2 })
  solidBox(W + 4, wallH, 2, 0, wallH, S + 2)
  for (const sign of [-1, 1]) {
    const half = (W + 4 - gap) / 2
    solidBox(half, wallH, flankDepth / 2, sign * (gap + half), wallH, N - flankDepth / 2)
  }
}
