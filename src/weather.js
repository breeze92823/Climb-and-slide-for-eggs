import { AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, NormalBlending, Points, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three'
import { LOBBY, RUN, zoneAt } from './config.js'
import { sfx } from './audio/index.js'
import { mulberry32, paintSoftDot } from './textures.js'

// The weather of the zone the player is in (ZONES). One cloud of points that wraps around a box
// on the camera, all in the vertex shader, so nothing is written per frame. A new zone fades the
// old weather out and its own in, and hands its sky to lighting.setZoneSky.
const BOX = new Vector3(44, 32, 44) // m
const MAX = 700 // points, the most any zone asks for
const FADE = 0.7 // s

const vertex = /* glsl */ `
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  uniform float uSize;
  uniform float uSway;
  uniform vec3 uVel;
  uniform vec3 uBox;
  uniform vec3 uCentre;
  varying float vEdge;
  void main() {
    vec3 p = position * uBox + uVel * uTime;
    p.x += sin(uTime * 0.7 + aPhase) * uSway;
    p.z += cos(uTime * 0.6 + aPhase * 1.7) * uSway;
    p = mod(p - uCentre + uBox * 0.5, uBox) - uBox * 0.5; // around the camera
    vec3 side = abs(p) / (uBox * 0.5);
    vEdge = 1.0 - smoothstep(0.75, 1.0, max(side.x, max(side.y, side.z)));
    vec4 mv = viewMatrix * vec4(p + uCentre, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / max(-mv.z, 0.5);
  }`
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uStreak;
  varying float vEdge;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a;
    if (uStreak > 0.5) a = 1.0 - smoothstep(0.02, 0.05, abs(gl_PointCoord.x - 0.5));
    gl_FragColor = vec4(uColor, a * vEdge * uOpacity);
    #include <colorspace_fragment>
  }`

export function createWeather(scene, lighting) {
  const rand = mulberry32(2024)
  const seeds = []
  const phases = []
  for (let i = 0; i < MAX; i++) {
    seeds.push(rand(), rand(), rand())
    phases.push(rand() * 6.283)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(seeds, 3))
  geometry.setAttribute('aPhase', new Float32BufferAttribute(phases, 1))
  const map = new CanvasTexture(paintSoftDot())
  map.colorSpace = SRGBColorSpace
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 400 },
      uSize: { value: 0 },
      uSway: { value: 0 },
      uVel: { value: new Vector3() },
      uBox: { value: BOX },
      uCentre: { value: new Vector3() },
      uMap: { value: map },
      uColor: { value: new Color() },
      uOpacity: { value: 0 },
      uStreak: { value: 0 },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  points.visible = false
  scene.add(points)

  const u = material.uniforms
  let zone = null
  let shown = null // the weather drawn, which lags `zone` while the old one fades
  let fade = 0
  let density = 1
  let nextBolt = 0

  function show(weather) {
    shown = weather
    points.visible = !!weather
    if (!weather) return
    u.uSize.value = weather.size
    u.uSway.value = weather.sway
    u.uVel.value.fromArray(weather.vel)
    u.uColor.value.set(weather.color)
    u.uStreak.value = weather.streak ? 1 : 0
    material.blending = weather.glow ? AdditiveBlending : NormalBlending
    geometry.setDrawRange(0, Math.ceil(weather.count * density))
  }

  return {
    setDensity(k) {
      density = k
      if (shown) geometry.setDrawRange(0, Math.ceil(shown.count * density))
    },
    // z: the player's. height: the drawing buffer's, in pixels.
    update(dt, elapsed, camera, z, height) {
      const next = zoneAt(Math.max(0, LOBBY.north - z) * RUN.metresPerS)
      if (next !== zone) {
        zone = next
        lighting.setZoneSky(zone.sky)
      }
      const wanted = zone.weather
      if (shown !== wanted) {
        fade -= dt / FADE
        if (fade <= 0) {
          fade = 0
          show(wanted)
        }
      } else if (shown) fade = Math.min(1, fade + dt / FADE)
      if (shown) {
        u.uOpacity.value = shown.opacity * fade
        u.uTime.value = elapsed
        u.uCentre.value.copy(camera.position)
        u.uScale.value = height / (2 * Math.tan((camera.fov * Math.PI) / 360))
      }
      if (zone.weather?.lightning) {
        nextBolt -= dt
        if (nextBolt <= 0) {
          nextBolt = zone.weather.lightning * (0.6 + Math.random() * 0.8)
          lighting.bolt()
          sfx.thunder()
        }
      }
    },
  }
}
