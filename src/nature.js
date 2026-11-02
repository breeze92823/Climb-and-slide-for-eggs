import { MeshStandardMaterial, NearestFilter } from 'three'
import { BASES, LOBBY, NATURE } from './config.js'
import { mulberry32, paintLeaves, toTexture } from './textures.js'
import { Blocks } from './voxel.js'

// Everything that grows: tiered voxel pines, tall cube trees, the two giant oaks behind
// the south wall, red mushrooms and the hedges on the walls of the plots. One foliage
// and one bark mesh hold all of it.
const { halfWidth: W, south: S } = LOBBY

export function createNature() {
  const leaves = new Blocks()
  const wood = new Blocks()

  // A chunky tier: a core box with its corners stepped in.
  const tier = (w, h, x, y, z, detail) => {
    leaves.box(w * 0.82, h, w * 0.82, x, y, z, '#ffffff')
    if (!detail) return
    leaves.box(w, h * 0.72, w * 0.72, x, y, z, '#ffffff')
    leaves.box(w * 0.72, h * 0.72, w, x, y, z, '#ffffff')
  }

  function pine(x, y, z, k = 1, detail = false) {
    wood.box(0.6 * k, 1.5 * k, 0.6 * k, x, y + 0.75 * k, z, NATURE.trunk)
    wood.box(1.5 * k, 0.32 * k, 0.5 * k, x, y + 0.16 * k, z, NATURE.trunk)
    wood.box(0.5 * k, 0.32 * k, 1.5 * k, x, y + 0.16 * k, z, NATURE.trunk)
    const tiers = [[4.4, 1.5], [3.7, 1.4], [2.9, 1.3], [2.1, 1.1], [1.3, 0.8]]
    let h = 1.4 * k
    for (const [w, t] of tiers) {
      tier(w * k, t * k, x, y + h + (t * k) / 2, z, detail)
      h += t * k * 0.92
    }
  }

  function cubeTree(x, y, z, k = 1) {
    wood.box(0.6 * k, 1.5 * k, 0.6 * k, x, y + 0.75 * k, z, NATURE.trunk)
    tier(3 * k, 4.6 * k, x, y + 3.6 * k, z, true)
    tier(2.2 * k, 0.5 * k, x, y + 6.1 * k, z, false)
  }

  function oak(x, y, z, k = 1, yaw = 0) {
    wood.at(x, y, z, yaw)
    leaves.at(x, y, z, yaw)
    const [bark, barkDark] = NATURE.oakBark
    wood.box(8 * k, 2.2 * k, 8 * k, 0, 1.1 * k, 0, barkDark)
    wood.box(6.4 * k, 6 * k, 6.4 * k, 0, 5 * k, 0, bark)
    wood.box(5 * k, 6 * k, 5 * k, 0, 11 * k, 0, barkDark)
    wood.box(4 * k, 7 * k, 4 * k, 0, 17 * k, 0, bark)
    // Stepped branches: out, then up.
    for (const [dir, h, len] of [[1, 10, 7], [-1, 13, 6], [1, 17, 5]]) {
      wood.box(len * k, 1 * k, 1.2 * k, (dir * (2 + len / 2) * k), h * k, 0, bark)
      wood.box(1 * k, 3 * k, 1.2 * k, dir * (2 + len) * k, (h + 1.5) * k, 0, barkDark)
    }
    wood.box(1.2 * k, 1 * k, 5 * k, 0, 12 * k, 4.5 * k, bark)
    const clumps = [[0, 25, 0, 13, 8], [-8, 22, 3, 8, 6], [8, 21, -2, 8, 7], [2, 21, 8, 8, 6], [-2, 22, -8, 9, 6], [10, 17, 0, 5, 4], [-9, 16, 0, 5, 4], [0, 31, 0, 8, 4]]
    for (const [cx, cy, cz, w, h] of clumps) tier(w * k, h * k, cx * k, cy * k, cz * k, true)
    wood.at()
    leaves.at()
  }

  // Filled in by plant(): a mushroom is red cap + white stem, kept in the bark mesh.
  function mushroom(x, y, z, k = 1) {
    wood.box(0.34 * k, 0.5 * k, 0.34 * k, x, y + 0.25 * k, z, '#f4eede')
    wood.box(1.1 * k, 0.32 * k, 1.1 * k, x, y + 0.62 * k, z, '#e81824')
    wood.box(0.78 * k, 0.24 * k, 0.78 * k, x, y + 0.88 * k, z, '#e81824')
    for (const [dx, dz] of [[0.3, 0.42], [-0.28, 0.42], [0.42, -0.1], [-0.42, 0.1]]) {
      wood.box(0.18 * k, 0.16 * k, 0.1 * k, x + dx * k, y + 0.66 * k, z + dz * k * 1.32, '#ffffff')
    }
  }

  // A patch of hanging leaves against a wall.
  function hedge(x, z, width, rand) {
    for (let i = 0; i < 20; i++) {
      const w = 0.8 + rand() * 1.5
      const h = 0.5 + rand() * 0.8
      leaves.box(w, h, 0.2, x + (rand() - 0.5) * width, 0.4 + rand() * 3.2, z - 0.12 - rand() * 0.14, '#ffffff')
    }
  }

  return {
    pine,
    // Everything on the terraces, given the terrain's height function.
    plant(scene, heightAt) {
      const rand = mulberry32(5150)
      const top = (x, z) => heightAt(x, z)

      // Hand-placed around the south rim, the way the screenshots frame them.
      const y = LOBBY.wallHeight + LOBBY.lip
      oak(30, top(30, S + 14) - 0.5, S + 14, 1, 0.2)
      oak(-35, top(-35, S + 15) - 0.5, S + 15, 1, -0.3)
      const southRow = [
        [-3.5, 9, 1.25, 'p'], [3.5, 10, 1, 'p'], [-19, 8, 0.95, 'c'], [-48, 9, 1.2, 'p'], [-53, 12, 0.95, 'p'],
        [46, 8, 1, 'c'], [17, 9, 1.2, 'p'], [11, 10, 0.9, 'p'], [52, 10, 1.25, 'p'], [-11, 13, 1, 'c'],
      ]
      for (const [x, dz, k, kind] of southRow) {
        const z = S + dz
        if (kind === 'p') pine(x, top(x, z), z, k, true)
        else cubeTree(x, top(x, z), z, k)
      }
      for (const [x, z] of [[-8, S + 3.5], [-6.5, S + 4.5], [9, S + 3.5], [10.6, S + 4.2], [-31, S + 3.5], [-29.6, S + 4.6], [30, S + 4], [31.6, S + 3.3]]) {
        mushroom(x, y, z, 1 + rand() * 0.5)
      }

      // Scattered over the east, south and west hills.
      let placed = 0
      for (let i = 0; i < 2000 && placed < NATURE.hillTrees; i++) {
        const a = rand() * Math.PI * 1.2 - Math.PI * 0.1 // from east round the south to west
        const r = 48 + rand() * 170
        const x = Math.cos(a) * (W + r)
        const z = S * 0.2 + Math.sin(a) * (S + r)
        if (Math.abs(x) < W + 6 && z < S + 6) continue
        const h = top(x, z)
        if (h <= 0) continue
        placed++
        if (rand() < 0.2) cubeTree(x, h, z, 1 + rand())
        else pine(x, h, z, 1.3 + rand() * 1.3, r < 80)
      }

      // The hedges on the back wall of the plots.
      for (const base of BASES.list) hedge(base.x - 1 + rand() * 2, S, 9, rand)

      const leafTex = toTexture(paintLeaves(NATURE.leaves), { srgb: true, anisotropy: 4 })
      leafTex.magFilter = NearestFilter
      const leafMesh = leaves.mesh(new MeshStandardMaterial({ map: leafTex, vertexColors: true, roughness: 0.75 }), false)
      const woodMesh = wood.mesh(new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), false)
      leafMesh.frustumCulled = woodMesh.frustumCulled = false
      scene.add(leafMesh, woodMesh)
    },
  }
}
