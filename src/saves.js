// Where every window keeps its progress. Each system calls load(key) once at start and
// store(key, section) whenever it changes, with the key from its own config (saveKey). A section
// is kept in memory and in localStorage (namespaced by the player, so a shared browser never
// mixes accounts); net.js sends the changed ones to the backend and, for a signed-in player,
// hydrate() puts the server's copy in before the systems start. The backend's flat document
// (Climb-and-slide-for-eggs-backend/src/db.ts PlayerDoc) is what `fields` maps each section onto.
import { DAILY, FARM, INDEX, LOBBY_HUD, REBIRTH, RUN, SELL, WEIGHTS } from './config.js'

const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

// section key -> { to: section -> doc fields, from: doc -> section fields (only those present) }
const SECTIONS = {
  [RUN.saveKey]: {
    to: (s) => ({ best: s.best, strength: s.strength, eggs: s.eggs, auto: s.auto }),
    from: (d) => defined({ best: d.best, strength: d.strength, eggs: d.eggs, auto: d.auto }),
  },
  [LOBBY_HUD.saveKey]: {
    to: (s) => ({ cash: s.cash, cashAt: s.at }),
    from: (d) => defined({ cash: d.cash, at: d.cashAt }),
  },
  [FARM.saveKey]: {
    to: (s) => ({ placed: s.placed, pets: s.pets, baseLevel: s.level }),
    from: (d) => defined({ placed: d.placed, pets: d.pets, level: d.baseLevel }),
  },
  [WEIGHTS.saveKey]: {
    to: (s) => ({ weightsOwned: s.owned, weightEquipped: s.equipped }),
    from: (d) => defined({ owned: d.weightsOwned, equipped: d.weightEquipped }),
  },
  [REBIRTH.saveKey]: {
    to: (s) => ({ rebirths: s.count }),
    from: (d) => defined({ count: d.rebirths }),
  },
  [INDEX.saveKey]: {
    to: (s) => ({ indexEggs: s.eggs, indexFound: s.found }),
    from: (d) => defined({ eggs: d.indexEggs, found: d.indexFound }),
  },
  [SELL.saveKey]: {
    to: (s) => ({ sellAuto: s.auto }),
    from: (d) => defined({ auto: d.sellAuto }),
  },
  // Only the paw coins: which days are claimed is the server's (net.js daily).
  [DAILY.saveKey]: {
    to: (s) => ({ paws: s.paws }),
    from: (d) => defined({ paws: d.paws }),
  },
}

let namespace = 'guest'
const memory = new Map() // key -> section
const listeners = new Set()

const storageKey = (key) => `${key}:${namespace}`

// Who the saves belong to (a Bloxity user id, or 'guest' / 'dev'). Call before anything loads.
export function setNamespace(id) {
  namespace = String(id || 'guest')
  memory.clear()
}

export function load(key) {
  if (memory.has(key)) return structuredClone(memory.get(key))
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(key)))
    if (saved && typeof saved === 'object') {
      memory.set(key, saved)
      return structuredClone(saved)
    }
  } catch {
    // No storage, or a bad save: the caller starts from its default.
  }
  return null
}

export function store(key, section, { quiet = false } = {}) {
  memory.set(key, structuredClone(section))
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(section))
  } catch {
    // Storage blocked: the progress lasts this session (and the backend, if signed in).
  }
  if (!quiet && SECTIONS[key]) for (const fn of listeners) fn(key)
}

// net.js: told which section changed, to send it.
export function onStore(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// The backend's document replaces what is stored here. Sections the document has no fields for
// (a new account's missing ones) stay as they are, the stored copy filling any gap.
export function hydrate(doc) {
  for (const [key, spec] of Object.entries(SECTIONS)) {
    const fromServer = spec.from(doc)
    if (!Object.keys(fromServer).length) continue
    store(key, { ...load(key), ...fromServer }, { quiet: true })
  }
}

// The flat document fields of the given sections (all of them without `keys`).
export function snapshot(keys = Object.keys(SECTIONS)) {
  const out = {}
  for (const key of keys) {
    const section = SECTIONS[key] && load(key)
    if (section) Object.assign(out, defined(SECTIONS[key].to(section)))
  }
  return out
}

export const sectionKeys = () => Object.keys(SECTIONS)
