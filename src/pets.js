import { speckle, voxelGeometry } from './voxel.js'

// The voxel pet and egg models, as filled ellipsoids and boxes in metres with the feet
// on y = 0, front toward +Z. Each kind is generated once, on first use.
const both = (fn) => [...fn(1), ...fn(-1)] // a part and its mirror image

const models = {
  gorilla() {
    const u = 0.14
    const hide = speckle(u * 2, ['#3e4c78', '#465684', '#364469'], 11)
    const dark = speckle(u * 2, ['#2c3858', '#333f62'], 12)
    return [voxelGeometry([
      ['e', 0, 1.9, -0.3, 1.25, 1.2, 1.3, hide], // back
      ['e', 0, 2.0, 0.5, 1.15, 1.15, 0.9, hide], // chest
      ['e', 0, 2.8, 1, 0.62, 0.62, 0.62, hide], // head
      ['b', -0.46, 2.72, 1.42, 0.46, 3.0, 1.62, dark], // brow
      ['b', -0.36, 2.76, 1.6, -0.12, 2.96, 1.66, '#f4f4f8'], // eyes
      ['b', 0.12, 2.76, 1.6, 0.36, 2.96, 1.66, '#f4f4f8'],
      ['b', -0.28, 2.8, 1.62, -0.18, 2.92, 1.7, '#10141e'],
      ['b', 0.18, 2.8, 1.62, 0.28, 2.92, 1.7, '#10141e'],
      ...both((m) => [
        ['e', m * 1.45, 1.5, 0.9, 0.5, 1.05, 0.5, hide], // arms
        ['b', m * 1.05, 0, 0.6, m * 1.9, 0.5, 1.5, dark], // knuckles
        ['e', m * 0.75, 0.7, -1, 0.55, 0.75, 0.6, hide], // legs
        ['b', m * 0.35, 0, -1.2, m * 1.15, 0.3, -0.3, dark],
      ]),
    ], u), 3]
  },
  mammoth() {
    const u = 0.17
    const fur = speckle(u * 2, ['#6a1f18', '#7c2a1e', '#541612'], 13)
    const tusk = '#f2e8d0'
    return [voxelGeometry([
      ['e', 0, 2.8, -0.6, 1.5, 1.7, 2.2, fur],
      ['b', -1.3, 2.1, -2.2, 1.3, 3.6, 1, fur],
      ['e', 0, 3.2, 1.8, 1.05, 1.15, 1, fur], // head
      ['b', -0.34, 0.2, 2.2, 0.34, 2.8, 2.9, fur], // trunk
      ...both((m) => [
        ['b', m * 0.55, 0, 0.1, m * 1.3, 1.6, 0.95, fur], // legs
        ['b', m * 0.55, 0, -2.3, m * 1.3, 1.6, -1.45, fur],
        ['b', m * 1, 2.4, 2.2, m * 1.35, 2.75, 2.6, tusk], // tusks
        ['b', m * 1, 1.5, 2.5, m * 1.35, 2.6, 2.85, tusk],
        ['b', m * 1, 1.3, 2.75, m * 1.3, 1.65, 3.5, tusk],
        ['b', m * 0.75, 3.1, 2.62, m * 0.42, 3.42, 2.74, '#101014'], // eyes
      ]),
      ['b', -0.95, 4.3, 0.95, 0.95, 4.5, 2.65, '#17171d'], // hat brim
      ['b', -0.62, 4.5, 1.3, 0.62, 5.2, 2.3, '#17171d'],
      ['b', -0.64, 4.5, 1.28, 0.64, 4.68, 2.32, '#7c2020'],
    ], u), 2]
  },
  seal() {
    const u = 0.12
    const skin = speckle(u * 2, ['#a79be6', '#b4a8ee', '#9a8edc'], 15)
    return [voxelGeometry([
      ['e', 0, 0.75, -0.8, 0.72, 0.68, 1.55, skin],
      ['e', 0, 1.25, 0.7, 0.6, 0.72, 0.68, skin],
      ...both((m) => [
        ['b', m * 0.55, 0, 0.4, m * 1.35, 0.25, 1.1, skin],
        ['b', m * 0.16, 1.45, 1.26, m * 0.34, 1.68, 1.36, '#15152a'],
      ]),
      ['b', -0.8, 0, -2.4, 0.8, 0.22, -2, skin],
      ['b', -0.1, 1.2, 1.3, 0.1, 1.32, 1.42, '#3a2a60'],
    ], u), 1.5]
  },
  diamond() {
    const u = 0.11
    const ice = speckle(u * 2, ['#27c6ea', '#4fdcf6', '#16aed8', '#8ff0ff'], 17)
    return [voxelGeometry([
      ['b', -0.95, 0.5, -0.8, 0.95, 2.1, 0.85, ice],
      ['b', -0.7, 2.1, -0.55, 0.7, 2.9, 0.65, ice],
      ...both((m) => [
        ['b', m * 0.4, 0, -0.5, m * 1.1, 0.6, 0.5, ice],
        ['b', m * 1, 0.8, -0.2, m * 1.5, 1.9, 0.4, ice],
        ['b', m * 0.14, 2.42, 0.64, m * 0.4, 2.66, 0.72, '#0c3550'],
      ]),
    ], u), 1.8]
  },
  dragon() {
    const u = 0.12
    const scale = speckle(u * 2, ['#25e02c', '#16b81f', '#58f05a'], 19)
    const wing = speckle(u * 2, ['#2cec34', '#1cc824'], 20)
    return [voxelGeometry([
      ['e', 0, 1.3, -0.3, 0.7, 0.75, 1.3, scale],
      ['b', -0.26, 1.4, 0.8, 0.26, 2.5, 1.3, scale], // neck
      ['e', 0, 2.65, 1.5, 0.44, 0.42, 0.7, scale],
      ['b', -0.2, 0.9, -2.8, 0.2, 1.2, -1.3, scale], // tail
      ['b', -0.12, 0.7, -3.4, 0.12, 0.96, -2.7, scale],
      ...both((m) => [
        ['b', m * 0.3, 0, 0.2, m * 0.72, 0.8, 0.7, scale],
        ['b', m * 0.3, 0, -1, m * 0.72, 0.8, -0.5, scale],
        ['b', m * 0.5, 1.9, -0.8, m * 1.6, 2.1, 0.5, wing],
        ['b', m * 1.5, 2.2, -1.1, m * 2.6, 2.4, 0.4, wing],
        ['b', m * 2.4, 2.6, -1.3, m * 3.2, 2.8, 0.1, wing],
        ['b', m * 0.14, 2.74, 2.02, m * 0.3, 2.92, 2.14, '#101010'],
      ]),
    ], u), 1.8]
  },
  shark() {
    const u = 0.12
    const skin = speckle(u * 2, ['#1fd63a', '#14b52b', '#4ff05a'], 21)
    return [voxelGeometry([
      ['e', 0, 0.8, 0, 0.75, 0.75, 2.3, skin],
      ['b', -0.1, 1.3, -0.5, 0.1, 2.2, 0.5, skin],
      ['b', -0.1, 0.5, -3, 0.1, 1.9, -2, skin],
      ...both((m) => [
        ['b', m * 0.6, 0.45, -0.1, m * 1.6, 0.65, 0.7, skin],
        ['b', m * 0.3, 0.98, 1.78, m * 0.52, 1.18, 1.86, '#0b1c10'],
      ]),
    ], u), 1.4]
  },
  puffer() {
    const u = 0.1
    const skin = speckle(u * 2, ['#ffb732', '#ffcd5a', '#f09a1e'], 23)
    return [voxelGeometry([
      ['e', 0, 0.75, 0, 0.72, 0.72, 0.72, skin],
      ['b', -0.3, 1.32, -0.08, -0.14, 1.62, 0.08, '#fff2c4'],
      ['b', 0.14, 1.32, -0.08, 0.3, 1.62, 0.08, '#fff2c4'],
      ['b', -0.08, 0.5, 0.65, 0.08, 0.66, 0.82, '#e0462a'],
      ...both((m) => [['b', m * 0.2, 0.86, 0.62, m * 0.44, 1.06, 0.76, '#101014']]),
    ], u), 1.6]
  },
  minotaur() {
    const u = 0.11
    const fur = speckle(u * 2, ['#b5804e', '#a57040', '#c4905e'], 25)
    const dark = '#5a3a24'
    return [voxelGeometry([
      ['b', -0.8, 1.5, -0.5, 0.8, 3, 0.5, fur], // torso
      ['b', -0.86, 1.1, -0.56, 0.86, 1.6, 0.56, '#3b7a3a'], // kilt
      ['e', 0, 3.4, 0.2, 0.62, 0.56, 0.62, fur],
      ...both((m) => [
        ['b', m * 0.2, 0, -0.34, m * 0.76, 1.3, 0.34, dark], // legs
        ['b', m * 0.86, 1.6, -0.28, m * 1.34, 3, 0.28, fur], // arms
        ['b', m * 0.5, 3.6, 0, m * 1.1, 3.82, 0.2, '#efe6d0'], // horns
        ['b', m * 1, 3.82, 0, m * 1.2, 4.2, 0.2, '#efe6d0'],
        ['b', m * 0.18, 3.46, 0.76, m * 0.36, 3.62, 0.84, '#101014'],
      ]),
    ], u), 2]
  },
  trex() {
    const u = 0.12
    const skin = speckle(u * 2, ['#c19a52', '#b08a46', '#d2ac62'], 27)
    const belly = '#e6d29a'
    return [voxelGeometry([
      ['e', 0, 1.9, -0.4, 0.75, 0.85, 1.6, skin],
      ['e', 0, 1.7, 0.2, 0.55, 0.7, 0.9, belly],
      ['b', -0.2, 1.4, -3.8, 0.2, 1.8, -1.6, skin], // tail
      ['b', -0.55, 2.5, 0.8, 0.55, 3.3, 2.5, skin], // head
      ['b', -0.5, 2.2, 1.2, 0.5, 2.5, 2.4, belly], // jaw
      ['b', -0.4, 2.46, 2.2, 0.4, 2.56, 2.5, '#ffffff'], // teeth
      ...both((m) => [
        ['b', m * 0.3, 0, -0.5, m * 0.8, 1.3, 0.2, skin],
        ['b', m * 0.3, 0, 0, m * 0.8, 0.22, 0.7, skin],
        ['b', m * 0.5, 1.9, 0.9, m * 0.7, 2.2, 1.5, skin], // little arms
        ['b', m * 0.3, 3.0, 1.9, m * 0.58, 3.16, 2.0, '#101014'],
      ]),
    ], u), 1.8]
  },
  pigeon() {
    const u = 0.08
    const f = speckle(u * 2, ['#37e24a', '#22c237', '#8af07e'], 29)
    return [voxelGeometry([
      ['e', 0, 0.52, 0, 0.34, 0.34, 0.5, f],
      ['e', 0, 0.92, 0.3, 0.22, 0.24, 0.24, f],
      ['b', -0.06, 0.86, 0.5, 0.06, 0.94, 0.68, '#ffb030'],
      ['b', -0.14, 0, 0, -0.06, 0.24, 0.08, '#ffb030'],
      ['b', 0.06, 0, 0, 0.14, 0.24, 0.08, '#ffb030'],
    ], u), 0.8]
  },
  cyanDog() {
    const u = 0.08
    const f = speckle(u * 2, ['#32d6ec', '#22bedc', '#7ceafa'], 31)
    return [voxelGeometry([
      ['b', -0.34, 0.36, -0.7, 0.34, 0.92, 0.5, f],
      ['b', -0.32, 0.72, 0.4, 0.32, 1.28, 0.98, f],
      ...both((m) => [
        ['b', m * 0.12, 0, 0.2, m * 0.32, 0.38, 0.42, f],
        ['b', m * 0.12, 0, -0.68, m * 0.32, 0.38, -0.46, f],
        ['b', m * 0.14, 1.28, 0.5, m * 0.32, 1.52, 0.74, f],
        ['b', m * 0.1, 1.02, 0.98, m * 0.22, 1.14, 1.02, '#0e2030'],
      ]),
    ], u), 1]
  },
  whiteCat() {
    const u = 0.07
    const f = speckle(u * 3, ['#f5f6fb', '#e4e7f2'], 33)
    return [voxelGeometry([
      ['e', 0, 0.4, -0.1, 0.34, 0.38, 0.5, f],
      ['e', 0, 0.82, 0.24, 0.3, 0.28, 0.28, f],
      ...both((m) => [
        ['b', m * 0.12, 1.02, 0.2, m * 0.28, 1.24, 0.3, f],
        ['b', m * 0.08, 0.84, 0.5, m * 0.18, 0.96, 0.56, '#20202c'],
      ]),
    ], u), 0.8]
  },
  duck() {
    const u = 0.08
    const f = speckle(u * 2, ['#ffdc32', '#ffc81e', '#fff07a'], 35)
    return [voxelGeometry([
      ['e', 0, 0.45, 0, 0.36, 0.34, 0.5, f],
      ['e', 0, 0.9, 0.28, 0.25, 0.25, 0.25, f],
      ['b', -0.12, 0.84, 0.5, 0.12, 0.92, 0.72, '#ff8a1e'],
      ...both((m) => [['b', m * 0.08, 0.96, 0.5, m * 0.18, 1.06, 0.54, '#14141c']]),
    ], u), 0.8]
  },
  polarEgg() {
    const u = 0.12
    const shell = speckle(u * 1.5, ['#f8fafe', '#e6ebf6', '#ffffff'], 37)
    return [voxelGeometry([['e', 0, 1.15, 0, 0.95, 1.2, 0.95, shell]], u), 1.6]
  },
}

const cache = new Map()
// { geometry, height }: height is where the pet's label floats, in model metres.
export function petModel(kind) {
  let m = cache.get(kind)
  if (!m) {
    const [geometry, height] = models[kind]()
    m = { geometry, height: height + 0.6 }
    cache.set(kind, m)
  }
  return m
}

// The T-Rex egg on the arena floor: a stepped tan egg with a toothy grin.
export function trexEgg() {
  const u = 0.09
  const shell = speckle(u * 2, ['#d4a650', '#c4943e', '#e0b866', '#b88a38'], 41)
  const mouth = (x, y, z) => (Math.abs(y - 0.72) < 0.12 && z > 0 ? '#e8201e' : '#f8f4ea')
  return voxelGeometry([
    ['e', 0, 0.98, 0, 0.82, 1, 0.78, shell],
    ['b', -0.84, 0.46, 0.2, 0.84, 0.98, 0.92, (x, y, z) => (((x / 0.84) ** 2 + ((y - 0.72) / 0.3) ** 2 + ((z + 0.1) / 1.04) ** 2) < 1.3 ? mouth(x, y, z) : null)],
    ['b', -0.46, 1.18, 0.62, -0.26, 1.34, 0.86, '#16120c'],
    ['b', 0.26, 1.18, 0.62, 0.46, 1.34, 0.86, '#16120c'],
  ], u)
}

// One end of the training dumbbell: a stepped dark ball with a hub ring.
export function dumbbellPlate() {
  const u = 0.09
  const rubber = speckle(u * 2, ['#2f3b3c', '#273233', '#37474a'], 43)
  return voxelGeometry([
    ['e', 0, 0, 0, 0.95, 0.95, 0.7, rubber],
    ['b', -0.2, -0.2, 0.55, 0.2, 0.2, 0.74, '#7a8688'],
    ['b', -0.1, -0.1, 0.6, 0.1, 0.1, 0.78, '#2f3b3c'],
  ], u)
}

// The secret jellyfish: a pink bell over tentacle ribbons, floating with feet at y = 0.
export function jellyfish() {
  const u = 0.1
  const pink = speckle(u * 2, ['#ff7ad6', '#ff62cc', '#ff90de'], 45)
  const bright = speckle(u * 2, ['#ff3cc8', '#ff24be', '#ff58d2'], 46)
  return voxelGeometry([
    ['b', -1.25, 3.9, -1.25, 1.25, 4.6, 1.25, pink], // the cap
    ['b', -0.95, 4.6, -0.95, 0.95, 4.85, 0.95, pink],
    ['b', -0.9, 3.5, -0.9, 0.9, 3.9, 0.9, bright], // the face under it
    ['b', -1.3, 3.15, -1.3, 1.3, 3.55, 1.3, pink], // the skirt
    ['b', -0.58, 3.58, 0.9, -0.14, 3.86, 0.98, '#ffffff'],
    ['b', 0.14, 3.58, 0.9, 0.58, 3.86, 0.98, '#ffffff'],
    ['b', -0.44, 3.6, 0.94, -0.24, 3.84, 1.02, '#1a1036'],
    ['b', 0.24, 3.6, 0.94, 0.44, 3.84, 1.02, '#1a1036'],
    // Long ribbons, a touch shorter at the edges.
    ...[-0.75, -0.25, 0.25, 0.75].flatMap((x, i) => [
      ['b', x - 0.2, i === 0 || i === 3 ? 0.5 : 0.05, 0.1, x + 0.2, 3.2, 0.5, bright],
      ['b', x - 0.2, i === 0 || i === 3 ? 0.7 : 0.3, -0.5, x + 0.2, 3.2, -0.1, bright],
    ]),
  ], u)
}

// The heap of gold under the gifts.
export function coinHeap(width, height, depth) {
  const u = 0.13
  const gold = speckle(u, ['#ffd93a', '#ffc81e', '#ffe878', '#f0ae14'], 47)
  return voxelGeometry([['e', 0, 0, 0, width / 2, height, depth / 2, gold]], u)
}

// The curved stone horns of the portal (one horn, tip at the top).
export function portalHorn(radius, height, thickness) {
  const u = 0.11
  const stone = (x, y, z) => (z > thickness * 0.1 ? '#d6dbe2' : '#a8afb9')
  const shapes = []
  for (let i = 0; i <= 36; i++) {
    const t = i / 36
    const a = t * Math.PI * 0.5
    const r = thickness * (1 - t * 0.92)
    shapes.push(['e', radius * (1 - Math.cos(a)), height * Math.sin(a), 0, r, r * 1.2, r, stone])
  }
  return voxelGeometry(shapes, u)
}
