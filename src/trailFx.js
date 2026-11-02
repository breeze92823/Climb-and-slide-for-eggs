import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { TRAILS } from './config.js'
import { player } from './player.js'

// The equipped trail: two crossed ribbons that follow the player's hips, narrowing and fading
// towards the tail, and folding back into the player when they stand still. One mesh, its
// vertices rewritten each frame; rainbow cycles hue along its length.
const N = TRAILS.length // points per ribbon
const STRIPS = 2 // one flat, one upright
const rainbow = new Color()
const tint = new Color()
const head = new Vector3()

export function createTrailFx(scene) {
  const points = Array.from({ length: N }, () => new Vector3())
  const position = new BufferAttribute(new Float32Array(STRIPS * N * 2 * 3), 3)
  const color = new BufferAttribute(new Float32Array(STRIPS * N * 2 * 4), 4)
  const index = []
  for (let s = 0; s < STRIPS; s++) {
    for (let i = 0; i < N - 1; i++) {
      const a = (s * N + i) * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', position)
  geometry.setAttribute('color', color)
  geometry.setIndex(index)
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, fog: false }))
  mesh.frustumCulled = false
  mesh.visible = false
  scene.add(mesh)

  let base = null // the trail's colour, or 'rainbow'
  let since = 0
  let fresh = true

  return {
    set(trail) {
      base = trail ? trail.color : null
      mesh.visible = !!trail
      fresh = true
    },
    update(dt) {
      if (!base) return
      const p = player.renderPosition
      head.set(p.x, p.y + TRAILS.height, p.z)
      if (fresh) {
        for (const q of points) q.copy(head)
        fresh = false
      }
      since += dt
      if (since >= TRAILS.every) {
        since = 0
        for (let i = N - 1; i > 0; i--) points[i].copy(points[i - 1])
      }
      points[0].copy(head)
      const moving = Math.hypot(player.velocity.x, player.velocity.z) > 0.8
      if (!moving) for (let i = 1; i < N; i++) points[i].lerp(head, 1 - Math.exp(-6 * dt))

      let px = 0
      let pz = 1
      for (let i = 0; i < N; i++) {
        const a = points[Math.max(0, i - 1)]
        const b = points[Math.min(N - 1, i + 1)]
        const dx = b.x - a.x
        const dz = b.z - a.z
        const len = Math.hypot(dx, dz)
        if (len > 1e-4) {
          px = -dz / len
          pz = dx / len
        }
        const t = i / (N - 1)
        const w = TRAILS.width * (1 - t) ** 0.7
        if (base === 'rainbow') tint.copy(rainbow.setHSL((t * 0.9 + performance.now() / 4000) % 1, 1, 0.55))
        else tint.set(base)
        const q = points[i]
        for (let s = 0; s < STRIPS; s++) {
          const v = (s * N + i) * 2
          const ox = s ? 0 : px * w
          const oy = s ? w : 0
          const oz = s ? 0 : pz * w
          position.setXYZ(v, q.x + ox, q.y + oy, q.z + oz)
          position.setXYZ(v + 1, q.x - ox, q.y - oy, q.z - oz)
          for (const k of [v, v + 1]) color.setXYZW(k, tint.r, tint.g, tint.b, (1 - t) ** 1.4 * 0.85)
        }
      }
      position.needsUpdate = true
      color.needsUpdate = true
    },
  }
}
