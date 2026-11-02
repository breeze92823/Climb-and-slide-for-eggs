import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three'
import { paintFade, paintSoftDot, paintSparkle, mulberry32 } from './textures.js'

// Lobby effects. Particles run entirely on the GPU: each one stores its origin,
// velocity, life and phase, and the vertex shader works out where it is from the
// time uniform, so nothing is touched per frame and any number of emitters share
// one draw call per sprite/blend. Everything is drawn once by `particles.build()`.

const vertex = /* glsl */ `
  attribute vec3 aVel;
  attribute vec3 aColor;
  attribute vec4 aData; // life, phase, size, gravity
  uniform float uTime;
  uniform float uScale;
  uniform float uGrow;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float life = aData.x;
    float t = fract(uTime / life + aData.y);
    float age = t * life;
    vec3 p = position + aVel * age;
    p.y += 0.5 * aData.w * age * age;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aData.z * (1.0 + uGrow * t) * uScale / max(-mv.z, 0.1);
    vColor = aColor;
    vAlpha = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.55, 1.0, t));
  }`
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }`

const sprite = (canvas) => {
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

export function createParticles(scene) {
  const rand = mulberry32(4711)
  const c = new Color()
  const layers = {
    spark: { map: sprite(paintSparkle()), blending: AdditiveBlending, opacity: 1, grow: 0, items: [] },
    glow: { map: sprite(paintSoftDot()), blending: AdditiveBlending, opacity: 0.8, grow: 0.6, items: [] },
    smoke: { map: sprite(paintSoftDot()), blending: NormalBlending, opacity: 0.55, grow: 1.4, items: [] },
  }
  const materials = []
  const geometries = []

  return {
    // One emitter. pos = centre, spread = half-extents of the box particles start
    // in, vel/jitter = m/s, life = s, size = m, gravity = m/s^2, boost = HDR colour.
    add({ layer = 'spark', count, pos, spread = [0, 0, 0], vel = [0, 0, 0], jitter = [0, 0, 0], life = 1.5, size = 0.3, gravity = 0, color = '#ffffff', color2 = null, boost = 1, radial = 0 }) {
      const items = layers[layer].items
      for (let i = 0; i < count; i++) {
        const offset = spread.map((s) => (rand() * 2 - 1) * s)
        const v = vel.map((b, k) => b + (rand() * 2 - 1) * jitter[k] + offset[k] * radial)
        c.set(color)
        if (color2) c.lerp(new Color(color2), rand())
        items.push({
          p: [pos[0] + offset[0], pos[1] + offset[1], pos[2] + offset[2]],
          v,
          c: [c.r * boost, c.g * boost, c.b * boost],
          d: [life * (0.75 + rand() * 0.5), rand(), size * (0.7 + rand() * 0.6), gravity],
          order: rand(),
        })
      }
    },
    // Uploads every emitter. Shuffled, so a lower density thins all of them evenly.
    build() {
      for (const layer of Object.values(layers)) {
        const items = layer.items.sort((a, b) => a.order - b.order)
        if (!items.length) continue
        const g = new BufferGeometry()
        g.setAttribute('position', new Float32BufferAttribute(items.flatMap((i) => i.p), 3))
        g.setAttribute('aVel', new Float32BufferAttribute(items.flatMap((i) => i.v), 3))
        g.setAttribute('aColor', new Float32BufferAttribute(items.flatMap((i) => i.c), 3))
        g.setAttribute('aData', new Float32BufferAttribute(items.flatMap((i) => i.d), 4))
        const m = new ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uGrow: { value: layer.grow }, uMap: { value: layer.map }, uOpacity: { value: layer.opacity } },
          vertexShader: vertex,
          fragmentShader: fragment,
          transparent: true,
          depthWrite: false,
          blending: layer.blending,
        })
        const points = new Points(g, m)
        points.frustumCulled = false
        scene.add(points)
        materials.push(m)
        geometries.push({ g, total: items.length })
      }
    },
    setDensity(k) {
      for (const { g, total } of geometries) g.setDrawRange(0, Math.ceil(total * k))
    },
    update(elapsed, height, fovDeg) {
      const scale = height / (2 * Math.tan((fovDeg * Math.PI) / 360))
      for (const m of materials) {
        m.uniforms.uTime.value = elapsed
        m.uniforms.uScale.value = scale
      }
    },
  }
}

// One-shot bursts, for what the looping emitters above cannot do (a splash where something
// landed). The same idea on a ring buffer: emit() writes particles with their birth time and
// the shader does the rest, so a slot is simply overwritten when its turn comes round.
const burstVertex = /* glsl */ `
  attribute vec3 aVel;
  attribute vec3 aColor;
  attribute vec4 aData; // birth, life, size, gravity
  uniform float uTime;
  uniform float uScale;
  uniform float uGrow;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float age = uTime - aData.x;
    float t = age / aData.y;
    if (t < 0.0 || t >= 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vec3 p = position + aVel * age;
    p.y += 0.5 * aData.w * age * age;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aData.z * (1.0 + uGrow * t) * uScale / max(-mv.z, 0.1);
    vColor = aColor;
    vAlpha = 1.0 - smoothstep(0.6, 1.0, t);
  }`

function paintChunk() {
  const c = document.createElement('canvas')
  c.width = c.height = 16
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 16, 16)
  return c
}

export function createBursts(scene, capacity = 700) {
  const rand = mulberry32(90210)
  const c = new Color()
  const c2 = new Color()
  const layers = {}
  const materials = []
  const make = (name, map, blending, grow) => {
    const g = new BufferGeometry()
    const attr = (key, size) => {
      const a = new BufferAttribute(new Float32Array(capacity * size), size)
      a.setUsage(DynamicDrawUsage)
      g.setAttribute(key, a)
      return a
    }
    const layer = { head: 0, position: attr('position', 3), vel: attr('aVel', 3), color: attr('aColor', 3), data: attr('aData', 4) }
    for (let i = 0; i < capacity; i++) layer.data.setXY(i, -1000, 1)
    const m = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uGrow: { value: grow }, uMap: { value: map }, uOpacity: { value: 1 } },
      vertexShader: burstVertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending,
    })
    const points = new Points(g, m)
    points.frustumCulled = false
    scene.add(points)
    materials.push(m)
    layers[name] = layer
  }
  make('chunk', sprite(paintChunk()), NormalBlending, -0.6)
  make('glow', sprite(paintSoftDot()), AdditiveBlending, 0.8)
  make('spark', sprite(paintSparkle()), AdditiveBlending, 0)
  let now = 0
  let density = 1

  return {
    // Same options as particles.add, at this moment and once.
    emit({ layer = 'spark', count, pos, spread = [0, 0, 0], vel = [0, 0, 0], jitter = [0, 0, 0], life = 0.8, size = 0.3, gravity = 0, color = '#ffffff', color2 = null, radial = 0 }) {
      const l = layers[layer]
      const n = Math.max(1, Math.round(count * density))
      c.set(color)
      c2.set(color2 ?? color)
      for (let k = 0; k < n; k++) {
        const i = l.head
        l.head = (i + 1) % capacity
        const ox = (rand() * 2 - 1) * spread[0]
        const oy = (rand() * 2 - 1) * spread[1]
        const oz = (rand() * 2 - 1) * spread[2]
        const mix = rand()
        l.position.setXYZ(i, pos[0] + ox, pos[1] + oy, pos[2] + oz)
        l.vel.setXYZ(i, vel[0] + (rand() * 2 - 1) * jitter[0] + ox * radial, vel[1] + (rand() * 2 - 1) * jitter[1] + oy * radial, vel[2] + (rand() * 2 - 1) * jitter[2] + oz * radial)
        l.color.setXYZ(i, c.r + (c2.r - c.r) * mix, c.g + (c2.g - c.g) * mix, c.b + (c2.b - c.b) * mix)
        l.data.setXYZW(i, now, life * (0.75 + rand() * 0.5), size * (0.7 + rand() * 0.6), gravity)
      }
      for (const a of [l.position, l.vel, l.color, l.data]) a.needsUpdate = true
    },
    setDensity(k) {
      density = k
    },
    update(elapsed, height, fovDeg) {
      now = elapsed
      const scale = height / (2 * Math.tan((fovDeg * Math.PI) / 360))
      for (const m of materials) {
        m.uniforms.uTime.value = elapsed
        m.uniforms.uScale.value = scale
      }
    },
  }
}

// --- Glow helpers --------------------------------------------------------------
const softDot = new CanvasTexture(paintSoftDot(128))
softDot.colorSpace = SRGBColorSpace
const fade = new CanvasTexture(paintFade())
fade.colorSpace = SRGBColorSpace

// Soft light pool on a flat surface (the ground, or a wall with `wall` yaw).
export function glowDecal(width, depth, color, opacity = 0.7) {
  const m = new Mesh(new PlaneGeometry(width, depth), new MeshBasicMaterial({ map: softDot, color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, fog: false }))
  m.renderOrder = 2
  return m
}

// A ring of rising light around a w x d footprint, brightest at the bottom.
export function lightCurtain(w, d, h, color, opacity = 0.55) {
  const group = new Group()
  const mat = new MeshBasicMaterial({ map: fade, color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: 2, fog: false })
  const sides = [[w, 0, d / 2, 0], [w, 0, -d / 2, 0], [d, w / 2, 0, Math.PI / 2], [d, -w / 2, 0, Math.PI / 2]]
  for (const [len, x, z, yaw] of sides) {
    const plane = new Mesh(new PlaneGeometry(len, h), mat)
    plane.position.set(x, h / 2, z)
    plane.rotation.y = yaw
    plane.renderOrder = 2
    group.add(plane)
  }
  group.userData.material = mat
  return group
}
