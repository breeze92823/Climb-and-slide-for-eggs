// What the player has collected for the Index window: eggs revealed and pets found, nothing
// at the start. Every pet belongs to one tab. Saved through saves.js (browser and backend).
// Hatching calls discoverPet, reaching an egg calls revealEgg.
import { INDEX } from './config.js'
import * as saves from './saves.js'

const roster = new Set(INDEX.eggs.flatMap((egg) => egg.pets.map((p) => `${p.tab}:${p.id}`)))
const eggs = new Set()
const found = new Set()
const listeners = new Set()

function load() {
  try {
    const saved = saves.load(INDEX.saveKey)
    if (!saved) return
    eggs.clear()
    found.clear()
    for (const id of saved.eggs) eggs.add(id)
    for (const key of saved.found) if (roster.has(key)) found.add(key) // old saves hold pets a tab no longer has
  } catch {
    // No storage, or a bad save: start from the default.
  }
}
// main.js calls this once the player's save is in (saves.js), before any window draws the Index.
export function loadIndex() {
  load()
  eggs.add(INDEX.eggs[0].id) // the first egg is always on show
}
loadIndex() // the first egg until then

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
export const totalCount = () => roster.size

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

function share(tab, egg) {
  const pets = egg.pets.filter((p) => p.tab === tab)
  return pets.filter((p) => isPetFound(tab, p.id)).length / pets.length
}

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
