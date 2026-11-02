import { buildBases } from './bases.js'
import { buildClimb, climbColliders } from './climb.js'
import { createBursts, createParticles } from './fx.js'
import { createNature } from './nature.js'
import { buildStands, propMaterial } from './stands.js'
import { buildTerrain, terrainColliders } from './terrain.js'
import { Blocks } from './voxel.js'

// The lobby, put together: the walled arena and its hills (terrain.js), the climb,
// the trees, the stands and the player plots. Static props all land in one mesh;
// update() runs the slide, the moving props and the particle clock.
export function createWorld(scene) {
  const { heightAt } = buildTerrain(scene)
  const particles = createParticles(scene)
  const bursts = createBursts(scene)
  const nature = createNature()
  const climb = buildClimb(scene, particles, nature.pine)
  nature.plant(scene, heightAt)

  const props = new Blocks()
  const stands = buildStands(scene, props, particles)
  const bases = buildBases(scene, props, particles)
  const mesh = props.mesh(propMaterial())
  mesh.frustumCulled = false
  scene.add(mesh)
  particles.build()

  return {
    bursts,
    climb,
    bases,
    // preset: a graphicsPreset() result.
    configure(preset) {
      particles.setDensity(preset.particles)
      bursts.setDensity(preset.particles)
      stands.setLights(preset.bloom) // phones keep the painted glows, not the extra lights
    },
    update(elapsed, camera, renderer) {
      climb.update(elapsed)
      stands.update(elapsed)
      bases.update(elapsed)
      particles.update(elapsed, renderer.domElement.height, camera.fov)
      bursts.update(elapsed, renderer.domElement.height, camera.fov)
    },
  }
}

// Collision for the arena and the climb (props add their own as they are built).
export function worldColliders() {
  terrainColliders()
  climbColliders()
}
