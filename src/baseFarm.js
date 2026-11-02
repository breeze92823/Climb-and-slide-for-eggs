import { Box3, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { BASE_UPGRADE, BASES, FARM, INDEX, PLAYTIME, RUN } from './config.js'
import * as bloxity from './bloxity.js'
import { getYaw } from './camera.js'
import { eggShell } from './climbRun.js'
import { formatCash } from './lobbyHud.js'
import { buildPet } from './petArt.js'
import { cashMulti, discoverPet, onIndexChange } from './petIndex.js'
import { player } from './player.js'
import { label, std } from './propkit.js'
import * as saves from './saves.js'

// The player's own plot. With an egg in hand a ghost shows where it would go; placed, it waits
// "Ready!" until hatched; hatching rolls a pet of that egg. Only active pets wander the plot and
// add their $/s to the base's rate, and the Upgrade Base sign buys room for more of them (the
// Pets window picks which). Eggs and pets are saved through saves.js.
const HW = BASES.width / 2 - FARM.margin
const Z0 = BASES.front + FARM.margin
const Z1 = BASES.back - FARM.margin
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

const eggOf = (id) => INDEX.eggs.find((e) => e.id === id)
// One of the list, each as likely as weight(item, i).
function pick(list, weight) {
  let roll = Math.random() * list.reduce((sum, item, i) => sum + weight(item, i), 0)
  return list.find((item, i) => (roll -= weight(item, i)) < 0) ?? list[0]
}
// Pets from an egg, or the Playtime Rewards' own, which the Index doesn't list.
export const petInfo = (id) => {
  const egg = INDEX.eggs.find((e) => e.pets.some((p) => p.id === id))
  if (!egg) return { ...PLAYTIME.pets.find((p) => p.id === id), tier: PLAYTIME.tier }
  return { ...egg.pets.find((p) => p.id === id), tier: RUN.tiers.find((t) => t.egg === egg.id) ?? PLAYTIME.tier, indexed: true }
}
const byCash = (a, b) => petInfo(b.id).cash - petInfo(a.id).cash
const cashSum = (list) => list.reduce((sum, p) => sum + petInfo(p.id).cash, 0)

function load() {
  try {
    const save = saves.load(FARM.saveKey)
    // Saves from before the slots hold plain ids.
    if (save) return { placed: save.placed ?? [], pets: (save.pets ?? []).map((p, i) => (typeof p === 'string' ? { id: p, on: i < BASE_UPGRADE.slots } : p)), level: save.level ?? 0 }
  } catch {
    // No storage, or a bad save: start from the default.
  }
  return { placed: [], pets: [], level: 0 }
}

// rebirth: the Rebirth window, which multiplies the rate.
export function createBaseFarm({ scene, camera, world, run, hud, rebirth }) {
  const { bursts, bases } = world
  const X0 = bases.x - HW // the player's plot, whichever seat the room gave them
  const X1 = bases.x + HW
  const inside = (x, z) => x > bases.x - BASES.width / 2 && x < bases.x + BASES.width / 2 && z > BASES.front && z < BASES.back
  let rateText = ''
  const save = load()
  const store = () => {
    try {
      saves.store(FARM.saveKey, save)
    } catch {
      // Storage blocked: the plot lasts this session.
    }
  }

  const active = () => save.pets.filter((p) => p.on)
  const slots = () => BASE_UPGRADE.slots + save.level * BASE_UPGRADE.slotsPerLevel
  const best = () => [...save.pets].sort(byCash).slice(0, slots())
  const listeners = new Set()
  const hatchListeners = new Set()
  let goalMulti = () => 1 // the portal's (goals.js)

  // --- Rate ------------------------------------------------------------------------------
  function refreshRate() {
    const multi = cashMulti() * rebirth.multi() * goalMulti()
    const animals = cashSum(active()) * multi
    const rate = FARM.income * multi + animals
    hud.setRate(rate, animals)
    bloxity.submitScore('earnings', rate)
    rateText = `${formatCash(rate)}$/s`
    bases.setOwner({ rate: rateText, multi: `x${multi.toFixed(2)}` })
    hud.setPetsReady(cashSum(best()) > cashSum(active()))
  }

  function changed() {
    store()
    refreshRate()
    for (const fn of listeners) fn()
  }

  // --- Placed eggs -----------------------------------------------------------------------
  const eggMat = std('#ffffff', { vertexColors: true, roughness: 0.7 })
  const eggs = []
  function addEgg(entry) {
    const tier = RUN.tiers[entry.tier]
    const mesh = new Mesh(eggShell(entry.tier), eggMat)
    mesh.castShadow = true
    mesh.position.set(entry.x, 0, entry.z)
    mesh.scale.setScalar(FARM.eggScale)
    const sign = label([[[eggOf(tier.egg).name, '#ffffff']], [[tier.name, tier.color]], [['Ready!', '#57f06a']]], 1.5, { font: '800 56px Fredoka, "Arial Black", sans-serif', outline: '#000000', outlineWidth: 7, pad: 8 })
    sign.position.set(entry.x, 3.2, entry.z)
    scene.add(mesh, sign)
    eggs.push({ entry, tier, mesh, sign, shake: -1 })
  }
  function removeEgg(egg) {
    scene.remove(egg.mesh, egg.sign)
    egg.sign.material.map.dispose()
    egg.sign.material.dispose()
    eggs.splice(eggs.indexOf(egg), 1)
    save.placed.splice(save.placed.indexOf(egg.entry), 1)
  }

  // --- Pets ------------------------------------------------------------------------------
  const pets = []
  const size = new Vector3()
  const somewhere = () => [X0 + Math.random() * (X1 - X0), Z0 + Math.random() * (Z1 - Z0)]
  function addPet(entry, x, z, pop) {
    const info = petInfo(entry.id)
    const group = new Group()
    const model = buildPet(entry.id)
    model.rotation.y = 0
    model.scale.setScalar(FARM.petScale)
    group.add(model)
    const height = new Box3().setFromObject(model).getSize(size).y
    const sign = label([[[info.name, '#ffffff']], [[info.tier.name, info.tier.color]], [[`$${formatCash(info.cash)}/s`, '#57f06a']]], 1.05, { font: '700 40px Fredoka, "Arial Black", sans-serif', outlineWidth: 5, pad: 8 })
    sign.position.y = height + 0.75
    const plus = label([[[`+$${formatCash(info.cash)}`, '#57f06a']]], 0.42, { font: '700 56px Fredoka, "Arial Black", sans-serif', outlineWidth: 6, pad: 6 })
    group.add(sign, plus)
    group.position.set(x, 0, z)
    scene.add(group)
    pets.push({ entry, group, model, plus, top: height + 1.35, tx: x, tz: z, wait: Math.random() * 3, phase: Math.random() * 6, pop })
  }
  function removePet(entry) {
    const [{ group }] = pets.splice(pets.findIndex((p) => p.entry === entry), 1)
    scene.remove(group)
    group.traverse((o) => {
      if (o.isSprite) {
        o.material.map.dispose()
        o.material.dispose()
      } else if (o.isMesh) {
        o.geometry.dispose()
        if (o.material.isMeshBasicMaterial) o.material.dispose()
      }
    })
  }

  // A new pet goes straight onto the plot if there is a free slot.
  function grant(id, x, z) {
    const entry = { id, on: active().length < slots() }
    save.pets.push(entry)
    if (entry.on) addPet(entry, x, z, 1)
    else hud.toast('Pets full! Upgrade your base for more')
    const info = petInfo(id)
    if (info.indexed) discoverPet(info.tab, id) // also marks the egg in the Index
    changed()
  }

  function setActive(entry, on) {
    if (entry.on === on) return true
    if (on && active().length >= slots()) return false
    entry.on = on
    if (on) addPet(entry, ...somewhere(), 1)
    else removePet(entry)
    changed()
    return true
  }

  function equipBest() {
    const top = new Set(best())
    for (const p of active()) if (!top.has(p)) setActive(p, false)
    for (const p of top) setActive(p, true)
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
    } else {
      pet.model.position.y = 0
      pet.wait -= dt
      if (pet.wait <= 0) {
        pet.wait = 1.5 + Math.random() * 4
        pet.tx = clamp(g.x + (Math.random() - 0.5) * 9, X0, X1)
        pet.tz = clamp(g.z + (Math.random() - 0.5) * 9, Z0, Z1)
      }
    }
    if (pet.pop > 0) {
      pet.pop = Math.max(0, pet.pop - dt * 2.4)
      const t = 1 - pet.pop
      pet.group.scale.setScalar(Math.max(0.01, t * (1 + Math.sin(t * Math.PI) * 0.4)))
    }
    // The +$ rises over the pet once a second.
    const t = (elapsed + pet.phase) % 1
    pet.plus.position.y = pet.top + t * 0.7
    pet.plus.material.opacity = 1 - t * t
  }

  function hatch(egg) {
    egg.shake = 0
    hud.prompt(null, 'farm')
  }
  function finishHatch(egg) {
    const { mesh, tier } = egg
    const p = mesh.position
    const tab = pick(INDEX.tabs, (t) => FARM.tabChance[t.id])
    const pet = pick(eggOf(tier.egg).pets.filter((p) => p.tab === tab.id), (_, i) => FARM.weights[i] ?? 0)
    bursts.emit({ layer: 'chunk', count: 40, pos: [p.x, 1.2, p.z], spread: [0.9, 1, 0.9], radial: 4, vel: [0, 3, 0], jitter: [2, 2, 2], gravity: -16, life: 0.8, size: 0.3, color: tier.shell[0], color2: tier.shell[2] })
    bursts.emit({ layer: 'glow', count: 12, pos: [p.x, 1.3, p.z], spread: [1, 1, 1], radial: 2, life: 0.7, size: 1.8, color: tier.color })
    bursts.emit({ count: 26, pos: [p.x, 1.4, p.z], spread: [1.1, 1.1, 1.1], radial: 3, life: 0.9, size: 0.34, color: '#ffffff', color2: tier.color })
    removeEgg(egg)
    grant(pet.id, p.x, p.z)
    hud.setEggsReady(eggs.length > 0)
    for (const fn of hatchListeners) fn()
  }

  // --- Ghost -----------------------------------------------------------------------------
  const ghostMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false })
  const ghost = new Mesh(eggShell(0), ghostMat)
  ghost.scale.setScalar(FARM.eggScale)
  ghost.visible = false
  scene.add(ghost)
  const clear = (x, z) => !eggs.some((e) => Math.hypot(e.entry.x - x, e.entry.z - z) < FARM.spacing)

  function place() {
    const tierIdx = run.heldTier()
    if (tierIdx === null) return
    const entry = { tier: tierIdx, x: ghost.position.x, z: ghost.position.z }
    run.takeEgg()
    save.placed.push(entry)
    addEgg(entry)
    store()
    hud.setEggsReady(true)
    for (const fn of listeners) fn()
    bursts.emit({ layer: 'chunk', count: 18, pos: [entry.x, 0.2, entry.z], spread: [0.9, 0.05, 0.9], radial: 2.4, vel: [0, 2.2, 0], jitter: [1, 1, 1], gravity: -14, life: 0.5, size: 0.2, color: '#ffffff', color2: RUN.tiers[tierIdx].color })
  }

  // --- Upgrade Base ----------------------------------------------------------------------
  const maxed = () => save.level >= BASE_UPGRADE.levels
  const upgradeCost = () => BASE_UPGRADE.cost * BASE_UPGRADE.growth ** save.level
  const showUpgrade = () => bases.setUpgrade({ cost: maxed() ? 'MAX' : `$${formatCash(upgradeCost())}`, level: `${save.level}/${BASE_UPGRADE.levels}` })

  function upgrade() {
    if (maxed() || !hud.spend(upgradeCost())) return
    save.level++
    showUpgrade()
    changed()
    hud.toast(`Base upgraded! ${slots()} active pets`)
    bursts.emit({ count: 30, pos: [bases.sign.x, 1.4, bases.sign.z + 0.4], spread: [1.3, 0.8, 0.3], radial: 3, vel: [0, 2, 0], life: 0.8, size: 0.3, color: '#ffffff', color2: '#57f06a' })
  }

  // --- Prompt ----------------------------------------------------------------------------
  let nearEgg = null
  let nearSign = false
  let canPlace = false
  const at = new Vector3()
  function showPrompt(x, y, z, text, extra) {
    at.set(x, y, z).project(camera)
    hud.prompt(at.z < 1 ? { x: (at.x + 1) / 2, y: (1 - at.y) / 2, text, ...extra } : null, 'farm')
  }

  const nearBoard = (p) => Math.hypot(bases.sign.x - p.x, bases.sign.z - p.z) < BASE_UPGRADE.reach
  function signPrompt() {
    const { sign } = bases
    nearSign = true
    const ready = !maxed() && hud.cash() >= upgradeCost()
    const text = maxed() ? 'Fully upgraded' : ready ? 'Upgrade' : `Need $${formatCash(upgradeCost())}`
    showPrompt(sign.x, 5, sign.z, text, ready ? { hold: true, act: upgrade } : { act: () => {} })
  }

  function action() {
    if (nearEgg) hatch(nearEgg)
    else if (nearSign) upgrade()
    else if (canPlace) place()
  }

  for (const entry of save.placed) addEgg(entry)
  for (const entry of active()) addPet(entry, ...somewhere(), 0)
  hud.setEggsReady(eggs.length > 0)
  hud.onPrompt(action)
  onIndexChange(refreshRate)
  rebirth.onChange(refreshRate)
  showUpgrade()
  refreshRate()
  hud.payOffline()

  return {
    action,
    // The Pets window: every pet, active ones first and the best first.
    list: () => [...save.pets].sort((a, b) => b.on - a.on || byCash(a, b)),
    activeCount: () => active().length,
    // What the other players see of this plot (net.sendBase): the active pets and the rate.
    summary: () => ({ p: active().map((p) => p.id), r: rateText }),
    slots,
    setActive,
    equipBest,
    onChange: (fn) => listeners.add(fn),
    onHatch: (fn) => hatchListeners.add(fn),
    setMulti(fn) {
      goalMulti = fn
      refreshRate()
    },
    refresh: refreshRate,
    // A pet from a reward: it lands anywhere on the plot.
    give: (id) => grant(id, ...somewhere()),
    upgrade,
    // The Growing Eggs window: the placed eggs (hatching ones included), and hatching one.
    growing: () => eggs.map((e) => ({ egg: e, tier: e.tier, hatching: e.shake >= 0 })),
    claimEgg(egg) {
      if (egg.shake < 0) hatch(egg)
    },
    // Sells a spare pet: false for one on the plot. The window pays for it.
    sell(entry) {
      if (entry.on) return false
      save.pets.splice(save.pets.indexOf(entry), 1)
      changed()
      return true
    },
    update(dt, elapsed) {
      for (const pet of pets) wander(pet, dt, elapsed)
      for (const egg of [...eggs]) {
        if (egg.shake < 0) continue
        egg.shake += dt
        egg.mesh.rotation.z = Math.sin(egg.shake * 34) * 0.14 * (0.4 + egg.shake)
        if (egg.shake >= FARM.hatchTime) finishHatch(egg)
      }

      bases.setUpgradeReady(!maxed() && hud.cash() >= upgradeCost())
      const p = player.position
      const idle = run.state() === 'idle'
      const home = idle && inside(p.x, p.z)
      hud.setInBase(home)
      nearEgg = null
      nearSign = false
      canPlace = false
      ghost.visible = false
      // The board faces out of the plot, so it works from outside the fence too.
      if (!home) return idle && nearBoard(p) ? signPrompt() : hud.prompt(null, 'farm')

      let best = FARM.hatchReach
      for (const egg of eggs) {
        const d = Math.hypot(egg.entry.x - p.x, egg.entry.z - p.z)
        if (egg.shake < 0 && d < best) {
          best = d
          nearEgg = egg
        }
      }
      const tierIdx = run.heldTier()
      if (nearEgg) {
        showPrompt(nearEgg.entry.x, 1.4, nearEgg.entry.z, 'Hatch')
      } else if (nearBoard(p)) {
        signPrompt()
      } else if (tierIdx !== null) {
        const yaw = getYaw()
        const x = clamp(p.x - Math.sin(yaw) * FARM.placeReach, X0, X1)
        const z = clamp(p.z - Math.cos(yaw) * FARM.placeReach, Z0, Z1)
        ghost.geometry = eggShell(tierIdx)
        ghost.position.set(x, 0, z)
        ghost.visible = true
        canPlace = clear(x, z) && eggs.length < FARM.maxEggs
        ghostMat.color.set(canPlace ? '#ffffff' : '#ff5a5a')
        if (canPlace) showPrompt(x, 1.2, z, 'Place')
        else hud.prompt(null, 'farm')
      } else {
        hud.prompt(null, 'farm')
      }
    },
  }
}
