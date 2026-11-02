// What the player has collected for the Index window: eggs revealed and pets found per tab
// (a Gold Parrot and a Normal Parrot are separate entries). Saved through saves.js (browser
// and backend). Hatching calls discoverPet, reaching an egg calls revealEgg.
import { INDEX } from './config.js'
import * as saves from './saves.js'

const seed = import.meta.env.DEV ? INDEX.devSeed : { eggs: [], pets: {} }
const eggs = new Set(seed.eggs)
const found = new Set(Object.entries(seed.pets).flatMap(([tab, ids]) => ids.map((id) => `${tab}:${id}`)))
const listeners = new Set()

function load() {
  try {
    const saved = saves.load(INDEX.saveKey)
    if (!saved) return
    eggs.clear()
    found.clear()
    for (const id of saved.eggs) eggs.add(id)
    for (const key of saved.found) found.add(key)
  } catch {
    // No storage, or a bad save: start from the default.
  }
}
// main.js calls this once the player's save is in (saves.js), before any window draws the Index.
export function loadIndex() {
  load()
  eggs.add(INDEX.eggs[0].id) // the first egg is always on show
}
loadIndex() // the dev seed / first egg until then

function changed() {
  try {
    saves.store(INDEX.saveKey, { eggs: [...eggs], found: [...found] })
  } catch {
    // Storage blocked: the progress lasts this session.
  }
  for (const fn of listeners) fn()
}

export const onIndexChange = (fn) => listeners.add(fn)

export const isEggRevealed = (eggId) => eggs.has(eggId)
export const isPetFound = (tab, petId) => found.has(`${tab}:${petId}`)
export const foundCount = () => found.size
export const totalCount = () => INDEX.tabs.length * INDEX.eggs.reduce((n, egg) => n + egg.pets.length, 0)

export function revealEgg(eggId) {
  if (eggs.has(eggId)) return
  eggs.add(eggId)
  changed()
}

export function discoverPet(tab, petId) {
  const key = `${tab}:${petId}`
  if (found.has(key)) return
  found.add(key)
  // A pet can only come out of its egg, so the egg has been reached.
  eggs.add(INDEX.eggs.find((egg) => egg.pets.some((p) => p.id === petId)).id)
  changed()
}

const share = (tab, egg) => egg.pets.filter((p) => isPetFound(tab, p.id)).length / egg.pets.length

// 0..1 towards the next egg completed in this tab: the unfinished egg closest to done.
export function eggProgress(tab) {
  const open = INDEX.eggs.map((egg) => share(tab, egg)).filter((s) => s < 1)
  return open.length ? Math.max(...open) : 1
}

// The Index's cash multiplier: every egg completed in any tab adds perEggBonus %.
export function cashMulti() {
  const done = INDEX.tabs.flatMap((t) => INDEX.eggs.filter((egg) => share(t.id, egg) === 1))
  return 1 + (done.length * INDEX.perEggBonus) / 100
}
