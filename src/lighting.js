import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  HemisphereLight,
  LinearFilter,
  Mesh,
  PMREMGenerator,
  PointLight,
  Points,
  PointsMaterial,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { FOG, LIGHT, TIME_OF_DAY } from './config.js'
import { mulberry32, paintCloudCover } from './textures.js'

// All scene lighting, blended between two moods (TIME_OF_DAY.day / .night):
//  - a gradient sky shader with a sun/moon disc and glow
//  - image-based lighting: the sky is baked into a PMREM environment map, so
//    every PBR material picks up matching ambient light and reflections
//    (re-baked as the mood changes)
//  - a hemisphere fill + one shadow-casting directional sun whose shadow box
//    follows the player (full shadow resolution over a small area)
//  - warm point-light lamps that switch on at night, with emissive bulbs
//  - distance fog in the horizon colour, stars at night, and tone-mapping
//    exposure, all following the same blend.
const SKY_RADIUS = 500

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`
const skyFragment = /* glsl */ `
  uniform vec3 top;
  uniform vec3 bottom;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform vec3 cloudColor;
  uniform sampler2D clouds;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 col = mix(bottom, top, smoothstep(-0.05, 0.42, h));
    float d = max(dot(normalize(vDir), sunDir), 0.0);
    col += sunColor * (pow(d, 900.0) * 6.0 + pow(d, 24.0) * 0.25); // disc + halo
    // Painted clouds, wrapped around the sky and thinning out overhead.
    float cover = texture2D(clouds, vec2(atan(vDir.z, vDir.x) / 6.28318 * 3.0, h * 1.1)).r;
    float shade = texture2D(clouds, vec2(atan(vDir.z, vDir.x) / 6.28318 * 3.0, h * 1.1 - 0.03)).r;
    cover *= smoothstep(-0.02, 0.1, h) * (1.0 - smoothstep(0.4, 0.75, h));
    col = mix(col, cloudColor * (0.9 + 0.1 * shade), cover);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

function sunDirection(elevationDeg, azimuthDeg, out) {
  const el = (elevationDeg * Math.PI) / 180
  const az = (azimuthDeg * Math.PI) / 180
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize()
}

function makeStars(count = 1400) {
  const rand = mulberry32(7)
  const pos = []
  for (let i = 0; i < count; i++) {
    const u = rand() * Math.PI * 2
    const v = Math.acos(rand() * 0.95) // upper hemisphere only
    const r = SKY_RADIUS * 0.9
    pos.push(Math.sin(v) * Math.cos(u) * r, Math.cos(v) * r, Math.sin(v) * Math.sin(u) * r)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  const mat = new PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: AdditiveBlending })
  const stars = new Points(geo, mat)
  stars.renderOrder = -1
  return stars
}

function cloudTexture() {
  const t = new CanvasTexture(paintCloudCover())
  t.wrapS = t.wrapT = RepeatWrapping
  t.generateMipmaps = false
  t.minFilter = LinearFilter // mipmaps would draw a seam where the angle wraps
  return t
}

export function createLighting(scene, renderer, preset) {
  // The two moods in use: TIME_OF_DAY, or a world's own sky (setMoods).
  let D = TIME_OF_DAY.day
  let N = TIME_OF_DAY.night

  // --- Sky + stars ---
  const skyMaterial = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new Color(D.zenith) },
      bottom: { value: new Color(D.horizon) },
      sunDir: { value: new Vector3(0, 1, 0) },
      sunColor: { value: new Color(D.sunColor) },
      cloudColor: { value: new Color(D.cloud) },
      clouds: { value: cloudTexture() },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
  })
  const sky = new Mesh(new SphereGeometry(SKY_RADIUS, 48, 24), skyMaterial)
  sky.renderOrder = -2
  sky.frustumCulled = false
  const stars = makeStars()
  scene.add(sky, stars)

  scene.fog = new Fog(D.horizon, FOG.near, FOG.far)

  // --- Lights ---
  const hemi = new HemisphereLight(D.hemiSky, D.hemiGround, D.hemiIntensity)
  const sun = new DirectionalLight(D.sunColor, D.sunIntensity)
  sun.castShadow = preset.shadows
  sun.shadow.mapSize.set(preset.shadowMap, preset.shadowMap)
  const r = LIGHT.shadowRange
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 220 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  scene.add(hemi, sun, sun.target)

  // --- Image-based lighting: bake the sky into an environment map ---
  const pmrem = new PMREMGenerator(renderer)
  const envScene = new Scene()
  envScene.add(new Mesh(sky.geometry, skyMaterial))
  let envTarget = null
  let bakedAt = -1
  function bakeEnvironment(night) {
    const next = pmrem.fromScene(envScene, 0, 1, SKY_RADIUS * 2)
    envTarget?.dispose()
    envTarget = next
    scene.environment = next.texture
    bakedAt = night
  }

  // --- Lamps (none placed right now) ---
  const lamps = [] // { light, bulb }
  function addLamp(x, y, z, bulbMaterial) {
    const light = new PointLight(LIGHT.lampColor, 0, LIGHT.lampDistance, 2)
    light.position.set(x, y, z)
    scene.add(light)
    lamps.push({ light, bulb: bulbMaterial })
    apply()
    return light
  }

  // --- Day/night blend ---
  let night = 0 // 0 = day, 1 = night
  let target = 0
  const dir = new Vector3()
  const tmpA = new Vector3()
  const tmpB = new Vector3()
  const c = new Color()
  const lerp = (a, b, t) => a + (b - a) * t
  const mix = (key, out) => out.set(D[key]).lerp(c.set(N[key]), night)

  // The sky of the climb zone the player is in (ZONES): laid over the mood, less so at night.
  const OVERLAY = ['zenith', 'horizon', 'cloud', 'sunColor', 'hemiSky', 'hemiGround']
  const overlay = Object.fromEntries(OVERLAY.map((key) => [key, new Color()]))
  const overlayFog = { near: FOG.near, far: FOG.far }
  let zoneSky = null
  let weight = 0 // how much of the overlay shows
  let settling = false
  let flash = 0 // lightning, 1 down to 0

  function applyZone() {
    const k = weight * (1 - night * 0.6)
    const u = skyMaterial.uniforms
    u.top.value.lerp(overlay.zenith, k)
    u.bottom.value.lerp(overlay.horizon, k)
    u.sunColor.value.lerp(overlay.sunColor, k)
    u.cloudColor.value.lerp(overlay.cloud, k)
    scene.fog.color.lerp(overlay.horizon, k)
    sun.color.lerp(overlay.sunColor, k)
    hemi.color.lerp(overlay.hemiSky, k)
    hemi.groundColor.lerp(overlay.hemiGround, k)
    scene.fog.near = lerp(FOG.near, overlayFog.near, weight)
    scene.fog.far = lerp(FOG.far, overlayFog.far, weight)
    u.top.value.lerp(c.set('#ffffff'), flash * 0.75)
    u.bottom.value.lerp(c, flash * 0.5)
    hemi.intensity += flash * 2.5
  }

  function settleZone(dt) {
    const k = 1 - Math.exp(-dt * 1.6)
    const goal = zoneSky ? 1 : 0
    if (zoneSky) {
      for (const key of OVERLAY) overlay[key].lerp(c.set(zoneSky[key]), weight < 0.01 ? 1 : k)
      overlayFog.near = lerp(overlayFog.near, zoneSky.fog[0], weight < 0.01 ? 1 : k)
      overlayFog.far = lerp(overlayFog.far, zoneSky.fog[1], weight < 0.01 ? 1 : k)
    }
    weight = lerp(weight, goal, k)
    if (Math.abs(weight - goal) < 0.01 && (!zoneSky || OVERLAY.every((key) => Math.abs(overlay[key].r - c.set(zoneSky[key]).r) < 0.01))) {
      weight = goal
      settling = false
      apply()
      bakeEnvironment(night)
    }
  }

  function apply() {
    const t = night
    mix('zenith', skyMaterial.uniforms.top.value)
    mix('horizon', skyMaterial.uniforms.bottom.value)
    mix('sunColor', skyMaterial.uniforms.sunColor.value)
    mix('cloud', skyMaterial.uniforms.cloudColor.value)
    mix('horizon', scene.fog.color)
    mix('sunColor', sun.color)
    mix('hemiSky', hemi.color)
    mix('hemiGround', hemi.groundColor)
    sun.intensity = lerp(D.sunIntensity, N.sunIntensity, t)
    hemi.intensity = lerp(D.hemiIntensity, N.hemiIntensity, t)
    scene.environmentIntensity = lerp(D.envIntensity, N.envIntensity, t)
    renderer.toneMappingExposure = lerp(D.exposure, N.exposure, t)
    stars.material.opacity = lerp(D.stars, N.stars, t)
    // Sun and moon are different directions: slerp-ish via normalised lerp of the two.
    sunDirection(D.sunElevation, D.sunAzimuth, tmpA)
    sunDirection(N.sunElevation, N.sunAzimuth, tmpB)
    dir.lerpVectors(tmpA, tmpB, t).normalize()
    skyMaterial.uniforms.sunDir.value.copy(dir)
    const lampLevel = lerp(D.lampIntensity, N.lampIntensity, t)
    for (const lamp of lamps) {
      lamp.light.intensity = lampLevel
      lamp.bulb.emissiveIntensity = 0.3 + (lampLevel / N.lampIntensity) * 3
    }
    applyZone()
  }

  apply()
  bakeEnvironment(0)

  return {
    sun,
    addLamp,
    isNight: () => target === 1,
    // A world's sky { day, night } (WORLDS): swapped at once, keeping day or night as it is.
    setMoods(sky) {
      if (sky.day === D && sky.night === N) return
      D = sky.day
      N = sky.night
      apply()
      bakeEnvironment(night)
    },
    toggleDayNight() {
      target = target === 1 ? 0 : 1
    },
    // A climb zone's `sky`, or null for the mood alone; blends over a few seconds.
    setZoneSky(sky) {
      zoneSky = sky
      settling = true
    },
    bolt() {
      flash = 1
    },
    setShadows(next) {
      sun.castShadow = next.shadows
      if (sun.shadow.mapSize.x !== next.shadowMap) {
        sun.shadow.mapSize.set(next.shadowMap, next.shadowMap)
        sun.shadow.map?.dispose()
        sun.shadow.map = null
      }
    },
    // Called every frame with the player's position so the sun's shadow box and the sky follow them.
    update(dt, focus) {
      if (night !== target) {
        const stepAmount = dt / TIME_OF_DAY.transition
        night = target > night ? Math.min(target, night + stepAmount) : Math.max(target, night - stepAmount)
        apply()
        if (Math.abs(night - bakedAt) > 0.08 || night === target) bakeEnvironment(night)
      }
      if (settling) settleZone(dt)
      if (settling || flash > 0) {
        flash = Math.max(0, flash - dt * 3.5)
        apply()
      }
      sky.position.set(focus.x, focus.y, focus.z)
      stars.position.copy(sky.position)
      sun.position.set(focus.x + dir.x * 90, focus.y + dir.y * 90, focus.z + dir.z * 90)
      sun.target.position.set(focus.x, focus.y, focus.z)
      sun.target.updateMatrixWorld()
    },
  }
}
