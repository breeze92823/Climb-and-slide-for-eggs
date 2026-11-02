import { BufferGeometry, Color, Euler, Float32BufferAttribute, Matrix4, Mesh, Vector3 } from 'three'
import { mulberry32 } from './textures.js'

// Two static-mesh builders, so the whole lobby stays a handful of draw calls:
//  - Blocks: accumulates boxes (each with its own colour and transform) into one mesh.
//  - voxelGeometry: fills a voxel grid from ellipsoids and boxes, then greedy-meshes
//    its visible faces (the stepped look of the eggs, pets and dumbbells).

const colors = new Map() // hex -> Color (linear), parsing a hex is the slow part of a box
function rgb(hex) {
  let c = colors.get(hex)
  if (!c) colors.set(hex, (c = new Color(hex)))
  return c
}

// Corner signs of the six box faces, counter-clockwise seen from outside.
const FACES = [
  { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], s: [2, 1] },
  { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], s: [2, 1] },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], s: [0, 2] },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], s: [0, 2] },
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], s: [0, 1] },
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], s: [0, 1] },
]
const v = new Vector3()
const nrm = new Vector3()
const euler = new Euler()
const local = new Matrix4()
const world = new Matrix4()

export class Blocks {
  // uvScale: metres per texture tile (world-scaled UVs); 0 = each face spans 0..1.
  constructor({ uvScale = 0 } = {}) {
    this.uvScale = uvScale
    this.base = new Matrix4()
    this.pos = []
    this.nor = []
    this.col = []
    this.uv = []
    this.idx = []
  }

  // Everything added next sits at this transform.
  at(x = 0, y = 0, z = 0, yaw = 0, scale = 1) {
    this.base.makeRotationY(yaw).scale(v.set(scale, scale, scale)).setPosition(x, y, z)
    return this
  }

  // A w x h x d box centred on (x, y, z). `rot` = [rx, ry, rz] radians.
  box(w, h, d, x, y, z, color, rot = null) {
    euler.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0)
    local.makeRotationFromEuler(euler).setPosition(x, y, z)
    world.multiplyMatrices(this.base, local)
    const c = rgb(color)
    const size = [w, h, d]
    for (const f of FACES) {
      const start = this.pos.length / 3
      nrm.fromArray(f.n).transformDirection(world)
      f.c.forEach((corner, i) => {
        v.set((corner[0] * w) / 2, (corner[1] * h) / 2, (corner[2] * d) / 2).applyMatrix4(world)
        this.pos.push(v.x, v.y, v.z)
        this.nor.push(nrm.x, nrm.y, nrm.z)
        this.col.push(c.r, c.g, c.b)
        const su = this.uvScale ? size[f.s[0]] / this.uvScale : 1
        const sv = this.uvScale ? size[f.s[1]] / this.uvScale : 1
        this.uv.push((i === 1 || i === 2 ? 1 : 0) * su, (i >= 2 ? 1 : 0) * sv)
      })
      this.idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
    }
    return this
  }

  // Adds a finished geometry's triangles (voxel models), transformed like a box.
  add(geo, x, y, z, yaw = 0, scale = 1) {
    local.makeRotationY(yaw).scale(v.set(scale, scale, scale)).setPosition(x, y, z)
    world.multiplyMatrices(this.base, local)
    const start = this.pos.length / 3
    const p = geo.attributes.position
    const n = geo.attributes.normal
    const c = geo.attributes.color
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(world)
      nrm.fromBufferAttribute(n, i).transformDirection(world)
      this.pos.push(v.x, v.y, v.z)
      this.nor.push(nrm.x, nrm.y, nrm.z)
      this.col.push(c.getX(i), c.getY(i), c.getZ(i))
      this.uv.push(0, 0)
    }
    for (let i = 0; i < geo.index.count; i++) this.idx.push(start + geo.index.getX(i))
    return this
  }

  geometry() {
    return indexedGeometry(this.pos, this.nor, this.col, this.uv, this.idx)
  }

  mesh(material, shadows = true) {
    const m = new Mesh(this.geometry(), material)
    m.castShadow = shadows
    m.receiveShadow = true
    return m
  }
}

function indexedGeometry(pos, nor, col, uv, idx) {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  if (uv) g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

// --- Voxel models ---------------------------------------------------------------
// shapes: filled in order, later ones overwrite earlier ones.
//   ['e', cx, cy, cz, rx, ry, rz, color]   ellipsoid
//   ['b', x0, y0, z0, x1, y1, z1, color]   box
// `color` is a hex, or fn(x, y, z) -> hex (see speckle). unit = voxel size in metres.
export function voxelGeometry(shapes, unit = 0.15) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const s of shapes) {
    const lo = s[0] === 'e' ? [s[1] - s[4], s[2] - s[5], s[3] - s[6]] : [Math.min(s[1], s[4]), Math.min(s[2], s[5]), Math.min(s[3], s[6])]
    const hi = s[0] === 'e' ? [s[1] + s[4], s[2] + s[5], s[3] + s[6]] : [Math.max(s[1], s[4]), Math.max(s[2], s[5]), Math.max(s[3], s[6])]
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], lo[a])
      max[a] = Math.max(max[a], hi[a])
    }
  }
  const dims = min.map((m, a) => Math.max(1, Math.ceil((max[a] - m) / unit)))
  const [nx, ny, nz] = dims
  const palette = [null]
  const paletteIndex = new Map()
  const grid = new Uint16Array(nx * ny * nz)
  const at = (x, y, z) => x + nx * (y + ny * z)
  for (let z = 0; z < nz; z++) {
    const pz = min[2] + (z + 0.5) * unit
    for (let y = 0; y < ny; y++) {
      const py = min[1] + (y + 0.5) * unit
      for (let x = 0; x < nx; x++) {
        const px = min[0] + (x + 0.5) * unit
        for (let i = shapes.length - 1; i >= 0; i--) {
          const s = shapes[i]
          const inside = s[0] === 'e'
            ? ((px - s[1]) / s[4]) ** 2 + ((py - s[2]) / s[5]) ** 2 + ((pz - s[3]) / s[6]) ** 2 <= 1
            : px >= Math.min(s[1], s[4]) && px <= Math.max(s[1], s[4]) && py >= Math.min(s[2], s[5]) && py <= Math.max(s[2], s[5]) && pz >= Math.min(s[3], s[6]) && pz <= Math.max(s[3], s[6])
          if (!inside) continue
          const color = typeof s[7] === 'function' ? s[7](px, py, pz) : s[7]
          if (!color) break // a null colour carves a hole
          let id = paletteIndex.get(color)
          if (id === undefined) {
            id = palette.length
            palette.push(rgb(color))
            paletteIndex.set(color, id)
          }
          grid[at(x, y, z)] = id
          break
        }
      }
    }
  }

  // Greedy meshing: each slice of faces with one normal is covered by rectangles.
  const pos = []
  const nor = []
  const col = []
  const idx = []
  const cell = [0, 0, 0]
  const fill = (c) => (c[0] < 0 || c[1] < 0 || c[2] < 0 || c[0] >= nx || c[1] >= ny || c[2] >= nz ? 0 : grid[at(c[0], c[1], c[2])])
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3
    const w = (d + 2) % 3
    const mask = new Int32Array(dims[u] * dims[w])
    for (cell[d] = -1; cell[d] < dims[d]; ) {
      let n = 0
      for (cell[w] = 0; cell[w] < dims[w]; cell[w]++) {
        for (cell[u] = 0; cell[u] < dims[u]; cell[u]++) {
          const a = fill(cell)
          cell[d]++
          const b = fill(cell)
          cell[d]--
          mask[n++] = !!a === !!b ? 0 : a ? a : -b
        }
      }
      cell[d]++
      n = 0
      for (let j = 0; j < dims[w]; j++) {
        for (let i = 0; i < dims[u]; ) {
          const m = mask[n]
          if (!m) {
            i++
            n++
            continue
          }
          let width = 1
          while (i + width < dims[u] && mask[n + width] === m) width++
          let height = 1
          grow: for (; j + height < dims[w]; height++) {
            for (let k = 0; k < width; k++) if (mask[n + k + height * dims[u]] !== m) break grow
          }
          const p = [0, 0, 0]
          p[d] = cell[d]
          p[u] = i
          p[w] = j
          const du = [0, 0, 0]
          const dw = [0, 0, 0]
          du[u] = width
          dw[w] = height
          const corners = m > 0
            ? [p, [p[0] + du[0], p[1] + du[1], p[2] + du[2]], [p[0] + du[0] + dw[0], p[1] + du[1] + dw[1], p[2] + du[2] + dw[2]], [p[0] + dw[0], p[1] + dw[1], p[2] + dw[2]]]
            : [p, [p[0] + dw[0], p[1] + dw[1], p[2] + dw[2]], [p[0] + du[0] + dw[0], p[1] + du[1] + dw[1], p[2] + du[2] + dw[2]], [p[0] + du[0], p[1] + du[1], p[2] + du[2]]]
          const c = palette[Math.abs(m)]
          const start = pos.length / 3
          for (const q of corners) {
            pos.push(min[0] + q[0] * unit, min[1] + q[1] * unit, min[2] + q[2] * unit)
            nor.push(d === 0 ? Math.sign(m) : 0, d === 1 ? Math.sign(m) : 0, d === 2 ? Math.sign(m) : 0)
            col.push(c.r, c.g, c.b)
          }
          idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
          for (let l = 0; l < height; l++) mask.fill(0, n + l * dims[u], n + l * dims[u] + width)
          i += width
          n += width
        }
      }
    }
  }
  return indexedGeometry(pos, nor, col, null, idx)
}

// Colour fn for voxelGeometry: hard pixel noise between shades, stable per voxel.
export function speckle(unit, colorList, seed = 1) {
  return (x, y, z) => {
    const h = mulberry32(Math.floor(x / unit) * 73856093 ^ Math.floor(y / unit) * 19349663 ^ Math.floor(z / unit) * 83492791 ^ seed)()
    return colorList[Math.floor(h * colorList.length)]
  }
}
