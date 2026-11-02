import { Box3, Group, Vector3 } from 'three'
import { BASES, FARM, WEIGHTS } from './config.js'
import { petInfo } from './baseFarm.js'
import { formatCash } from './lobbyHud.js'
import { buildPet } from './petArt.js'
import { label } from './propkit.js'
import { weightGeometry } from './weightArt.js'

// The plot of another player in the room: their name and rate on the sign, their active pets
// wandering inside the fence (the same models and signs as the player's own plot), and the
// weight they have equipped on their training pad. Everything comes from presence: the seat's
// PlayerState (name, pose) and its `base` JSON ({ p: pet ids, w: weight id, r: rate text }, sent by
// the owner's client through net.sendBase). An empty seat shows its placeholder sign and nothing else.
const HW = BASES.width / 2 - FARM.margin
const MAX_PETS = 16
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const NONE = { p: [], w: '', r: '' }

function parse(text) {
  try {
    const m = JSON.parse(text)
    return { p: Array.isArray(m.p) ? m.p.filter((id) => typeof id === 'string') : [], w: typeof m.w === 'string' ? m.w : '', r: typeof m.r === 'string' ? m.r : '' }
  } catch {
    return NONE
  }
}

function disposeSprite(o) {
  o.material.map?.dispose()
  o.material.dispose()
}

// base: the plot (x, name, rate); pad: trainingPad()'s { x, z, radius, weight }; paint(rate, name)
// makes the name + rate sign; portrait: the owner sign's face.
export function createRemoteBase({ scene, base, pad, paint, portrait }) {
  const x0 = base.x - HW
  const x1 = base.x + HW
  const z0 = BASES.front + FARM.margin
  const z1 = BASES.back - FARM.margin
  const size = new Vector3()
  const pets = []
  let sign = null
  let signKey = null
  let raw = null
  let data = NONE
  let weightId = null

  function setSign(next) {
    if (sign) {
      scene.remove(sign)
      disposeSprite(sign)
    }
    sign = next
    scene.add(sign)
  }

  function addPet(id) {
    const info = petInfo(id)
    if (!info?.name || !info.tier) return
    const group = new Group()
    const model = buildPet(id)
    model.rotation.y = 0
    model.scale.setScalar(FARM.petScale)
    group.add(model)
    const height = new Box3().setFromObject(model).getSize(size).y
    const tag = label([[[info.name, '#ffffff']], [[info.tier.name, info.tier.color]], [[`$${formatCash(info.cash)}/s`, '#57f06a']]], 1.05, { font: '700 40px Fredoka, "Arial Black", sans-serif', outlineWidth: 5, pad: 8 })
    tag.position.y = height + 0.75
    group.add(tag)
    group.position.set(x0 + Math.random() * (x1 - x0), 0, z0 + Math.random() * (z1 - z0))
    scene.add(group)
    const pet = { id, group, model, tx: group.position.x, tz: group.position.z, wait: Math.random() * 3, phase: Math.random() * 6 }
    pets.push(pet)
  }

  function removePet(pet) {
    pets.splice(pets.indexOf(pet), 1)
    scene.remove(pet.group)
    pet.group.traverse((o) => {
      if (o.isSprite) disposeSprite(o)
      else if (o.isMesh) {
        o.geometry.dispose()
        if (o.material.isMeshBasicMaterial) o.material.dispose()
      }
    })
  }

  // Adds and drops only the pets that changed, so the others keep wandering where they are.
  function syncPets(ids) {
    const want = ids.slice(0, MAX_PETS)
    for (const pet of [...pets]) {
      const i = want.indexOf(pet.id)
      if (i < 0) removePet(pet)
      else want.splice(i, 1)
    }
    for (const id of want) addPet(id)
  }

  function wander(pet, dt, elapsed) {
    const g = pet.group.position
    const dx = pet.tx - g.x
    const dz = pet.tz - g.z
    const dist = Math.hypot(dx, dz)
    if (dist > 0.1) {
      const step = Math.min(dist, FARM.petSpeed * dt)
      g.x += (dx / dist) * step
      g.z += (dz / dist) * step
      pet.model.rotation.y = Math.atan2(dx, dz)
      pet.model.position.y = Math.abs(Math.sin(elapsed * 9 + pet.phase)) * 0.28
      return
    }
    pet.model.position.y = 0
    pet.wait -= dt
    if (pet.wait > 0) return
    pet.wait = 1.5 + Math.random() * 4
    pet.tx = clamp(g.x + (Math.random() - 0.5) * 9, x0, x1)
    pet.tz = clamp(g.z + (Math.random() - 0.5) * 9, z0, z1)
  }

  setSign(paint(base.rate, base.name))
  portrait.visible = false

  return {
    // player: the seat's PlayerState, or undefined while nobody holds it.
    show(player, dt, elapsed) {
      if (player && player.base !== raw) {
        raw = player.base
        data = parse(raw)
      }
      if (!player) data = NONE
      const key = player ? `${player.username}|${data.r}` : ''
      if (key !== signKey) {
        signKey = key
        setSign(player ? paint(data.r || 'Joining...', player.username || 'Player') : paint(base.rate, base.name))
        portrait.visible = !!player
      }

      // Their equipped weight lies on the pad until they step on it to lift.
      const id = WEIGHTS.list.some((w) => w.id === data.w) ? data.w : WEIGHTS.list[0].id
      if (player && id !== weightId) {
        weightId = id
        const geometry = weightGeometry(id)
        pad.weight.geometry = geometry
        pad.weight.position.y = -geometry.boundingBox.min.y
      }
      const lifting = !!player && player.posed && Math.hypot(player.x - pad.x, player.z - pad.z) < pad.radius * 0.7
      pad.weight.visible = !!player && !lifting

      syncPets(player ? data.p : [])
      for (const pet of pets) wander(pet, dt, elapsed)
    },
  }
}
