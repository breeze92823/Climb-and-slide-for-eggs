import { BufferAttribute, CanvasTexture, Color, CylinderGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { BASES, LOBBY } from './config.js'
import { fontReady, label, solidBox, solidPole, std } from './propkit.js'
import { paintPortrait, paintSign, paintUpgradeButton } from './textures.js'
import { Blocks } from './voxel.js'
import * as net from './net.js'
import { createRemoteBase } from './remoteBases.js'

// The player plots along the south wall, one per room seat: a fence with a gap in front, a
// floating owner sign, and out on the floor each plot's training pad. The local player's seat is
// theirs (pets, Upgrade Base sign, Upgrades pad: baseFarm.js); the others show whoever holds the
// seat (remoteBases.js) and wait empty otherwise. The static parts go in the shared `b`; only the
// gold crates another player is lifting move.

function fenceRun(b, style, ax, az, bx, bz) {
  const f = BASES.fences[style]
  const len = Math.hypot(bx - ax, bz - az)
  const along = Math.abs(bx - ax) > Math.abs(bz - az)
  const n = Math.max(1, Math.round(len / BASES.rail))
  const cx = (ax + bx) / 2
  const cz = (az + bz) / 2
  for (const h of [0.5, 0.9]) {
    const thick = style === 'checker' ? 0.18 : 0.14
    if (along) b.box(len, thick, 0.12, cx, h, cz, f.rail)
    else b.box(0.12, thick, len, cx, h, cz, f.rail)
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = ax + (bx - ax) * t
    const z = az + (bz - az) * t
    if (style === 'checker') {
      b.box(0.5, 1.2, 0.5, x, 0.6, z, f.post[1])
      b.box(0.54, 0.42, 0.54, x, 0.68, z, f.post[0])
    } else {
      b.box(0.4, 0.56, 0.4, x, 0.28, z, f.post[0])
      b.box(0.34, 0.66, 0.34, x, 0.87, z, f.post[1])
    }
  }
  if (along) solidBox(len / 2, 1, 0.14, cx, 1, cz)
  else solidBox(0.14, 1, len / 2, cx, 1, cz)
}

function disc(radius, height, segments, color) {
  const g = new CylinderGeometry(radius, radius, height, segments).toNonIndexed()
  const c = new Color(color)
  const count = g.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new BufferAttribute(colors, 3))
  g.setIndex([...Array(count).keys()])
  return g
}

function trainingPad(scene, b, base, cx) {
  const { padOffset, padRadius: r } = BASES
  const x = cx + padOffset.x
  const z = BASES.front + padOffset.z
  b.at()
  b.add(disc(r, 0.06, 18, '#6414ff'), x, 0.03, z)
  b.add(disc(r - 0.14, 0.08, 18, '#d48cff'), x, 0.04, z)
  b.add(disc(r - 0.3, 0.1, 18, '#dcd6cc'), x, 0.05, z)
  // Its own mesh: whichever weight is equipped (yours: the player picks this one up) or the
  // occupant's; hidden on an empty plot.
  const weight = new Mesh(undefined, std('#ffffff', { vertexColors: true, roughness: 0.6 }))
  weight.position.set(x, 0, z)
  weight.rotation.y = 1.15
  weight.castShadow = true
  weight.visible = !!base.owner
  scene.add(weight)
  const pad = { x, z, radius: r, weight }
  if (!base.owner) return pad
  const paintGain = (text) => {
    const gain = label([[[text, '#ffc66a']]], 0.72, { font: '800 72px Fredoka, "Arial Black", sans-serif', outline: '#3a2410', outlineWidth: 9 })
    gain.position.set(x, 3.1, z)
    return gain
  }
  const up = BASES.upgrades
  const ux = cx + up.x
  const uz = BASES.front + up.z
  b.box(2.7, 0.08, 1.9, ux, 0.04, uz, '#ffffff')
  b.box(2.34, 0.12, 1.54, ux, 0.08, uz, '#ffe01e')
  const paintCost = (text) => {
    const cost = label([[['Upgrades', '#ffffff']], [[text, '#57f06a']]], 0.82, { font: '700 56px Fredoka, "Arial Black", sans-serif', outlineWidth: 7 })
    cost.position.set(ux, 1.2, uz)
    return cost
  }
  return { ...pad, paintGain, paintCost, upgrades: { x: ux, z: uz } }
}

// The stone board on the corner of your plot. The green button shows the next upgrade's price and
// the level; the red ! floats over it while the player can pay.
function upgradeSign(scene, b, x, z) {
  const YAW = Math.PI - 0.25 // faces north, out of the plot toward the lobby
  b.at(x, 0, z, YAW)
  b.box(5.4, 3.8, 0.6, 0, 1.9, 0, '#868e98')
  b.box(0.72, 4.4, 0.8, -2.84, 2.2, 0, '#3f4650')
  b.box(0.72, 4.4, 0.8, 2.84, 2.2, 0, '#3f4650')
  b.at()
  const painted = paintSign('Upgrade Base', { board: '#868e98', border: null, color: '#eef1f4', font: '700 56px Fredoka, sans-serif', w: 480, h: 96 })
  const tex = new CanvasTexture(painted.canvas)
  tex.colorSpace = SRGBColorSpace
  fontReady.then(() => {
    painted.draw()
    tex.needsUpdate = true
  })
  const front = (mesh, y) => {
    mesh.position.set(x + Math.sin(YAW) * 0.34, y, z + Math.cos(YAW) * 0.34)
    mesh.rotation.y = YAW
    scene.add(mesh)
  }
  front(new Mesh(new PlaneGeometry(4.6, 0.92), new MeshBasicMaterial({ map: tex })), 3)

  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 192
  const button = new CanvasTexture(canvas)
  button.colorSpace = SRGBColorSpace
  front(new Mesh(new PlaneGeometry(4, 2), new MeshBasicMaterial({ map: button })), 1.48)

  const mark = label([[['!', '#ff2a2a']]], 5.2, { font: '800 200px Fredoka, "Arial Black", sans-serif', outline: '#ffffff', outlineWidth: 10 })
  mark.position.set(x, 9.2, z)
  mark.visible = false
  scene.add(mark)
  solidBox(3.2, 2, 0.4, x, 2, z, YAW)
  let shown = null
  const show = () => {
    if (!shown) return
    paintUpgradeButton(canvas, shown.cost, shown.level)
    button.needsUpdate = true
  }
  fontReady.then(show)
  return {
    x,
    z,
    mark,
    show(info) {
      shown = info
      show()
    },
  }
}

function ownerSign(scene, base) {
  const size = base.signSize
  const y = LOBBY.wallHeight + LOBBY.lip + 3.4
  const z = LOBBY.south + 2
  const portrait = new Sprite(new SpriteMaterial({ map: portraitTexture(base.portrait), transparent: true, depthWrite: false, fog: false }))
  portrait.scale.set(size, size, 1)
  portrait.position.set(base.x, y + size * 0.72, z)
  const paint = (rate, name = base.name) => {
    const text = label([[[name, base.nameColor]], [[rate, '#57f06a']]], size * 0.72, { font: '700 56px Fredoka, "Arial Black", sans-serif', outline: '#1a1a1a', outlineWidth: 8 })
    text.position.set(base.x, y - size * 0.2, z)
    return text
  }
  scene.add(portrait)
  return { paint, portrait }
}

// Swaps a label for a freshly painted one.
function swap(scene, old, next) {
  if (old) {
    scene.remove(old)
    old.material.map.dispose()
    old.material.dispose()
  }
  scene.add(next)
  return next
}

function portraitTexture(look) {
  const t = new CanvasTexture(paintPortrait(look))
  t.colorSpace = SRGBColorSpace
  return t
}

// A blocky bystander. crates > 0: lifting a stack of gold boxes; else a stone ball.
function bystander(scene, b, particles, npc) {
  const { name, x, z, yaw, crates } = npc
  b.at(x, 0, z, yaw)
  const suit = crates ? '#35b0a0' : '#1c2028'
  b.box(0.28, 0.8, 0.3, -0.2, 0.4, 0, crates ? '#d8406a' : '#1c2028')
  b.box(0.28, 0.8, 0.3, 0.2, 0.4, 0, crates ? '#d8406a' : '#1c2028')
  b.box(0.76, 0.72, 0.4, 0, 1.16, 0, suit)
  b.box(0.26, 0.78, 0.3, -0.52, 1.5, 0, suit, [0, 0, 0.22])
  b.box(0.26, 0.78, 0.3, 0.52, 1.5, 0, suit, [0, 0, -0.22])
  b.box(0.5, 0.48, 0.48, 0, 1.76, 0, '#f2c79a')
  b.box(0.56, 0.2, 0.54, 0, 2.02, 0, crates ? '#b83a1e' : '#30343c')
  b.at()
  solidPole(0.5, 2.2, x, z)

  const stack = new Blocks()
  const gold = ['#ffd21e', '#f4b414', '#e49c10']
  for (let i = 0; i < crates; i++) {
    const ox = i % 2 ? 0.24 : -0.18
    stack.box(1.05, 0.72, 1.05, ox, i * 0.74, 0, gold[i % 3], [0, i * 0.3, 0])
    stack.box(1.09, 0.1, 1.09, ox, i * 0.74, 0, gold[(i + 1) % 3], [0, i * 0.3, 0])
  }
  if (!crates) stack.box(0.9, 0.7, 0.9, 0, 0, 0, '#8a9098')
  const load = stack.mesh(std('#ffffff', { vertexColors: true, roughness: 0.5, metalness: 0.15 }))
  load.position.set(x, 2.7, z)
  scene.add(load)
  if (crates) particles.add({ count: 26, pos: [x, 3.2, z], spread: [0.9, 1.2, 0.9], vel: [0, 0.7, 0], jitter: [0.3, 0.4, 0.3], gravity: -0.8, life: 1.3, size: 0.17, color: '#ffe65a', color2: '#b8ff6a', boost: 1.5 })
  const tag = label([[[name, '#ffffff']]], 0.34, { font: '600 48px Fredoka, sans-serif', outline: '#20201c', outlineWidth: 6 })
  tag.position.set(x, crates ? 3.5 : 3.4, z)
  scene.add(tag)
  return { load, base: 2.7, phase: x, range: crates ? 0.42 : 0.3 }
}

export function buildBases(scene, b, particles, seat) {
  const hw = BASES.width / 2
  const { front: F, back: B, gateWidth } = BASES
  let mine = null // the player's own signs, which change
  let sign = null // the player's Upgrade Base sign
  let pad = null // the player's own training pad
  let lifting = false
  const others = [] // { seat, plot }: the plots another player may hold
  BASES.list.forEach((plot, i) => {
    const base = i === seat ? { ...plot, ...BASES.owner, owner: true } : { ...plot, ...BASES.empty }
    const cx = base.x
    b.at()
    fenceRun(b, base.fence, cx - hw, F, cx - gateWidth / 2, F)
    fenceRun(b, base.fence, cx + gateWidth / 2, F, cx + hw, F)
    fenceRun(b, base.fence, cx - hw, F, cx - hw, B)
    fenceRun(b, base.fence, cx + hw, F, cx + hw, B)
    fenceRun(b, base.fence, cx - hw, B, cx + hw, B)

    const seatPad = trainingPad(scene, b, base, cx)
    const { paint: paintRate, portrait } = ownerSign(scene, base)
    if (!base.owner) {
      others.push({ seat: i, plot: createRemoteBase({ scene, base, pad: seatPad, paint: paintRate, portrait }) })
      return
    }
    pad = seatPad
    sign = upgradeSign(scene, b, cx + base.sign.x, F + base.sign.z)
    const paintMulti = (value) => {
      const cash = label([[['CASH MULTI:', '#ffffff']], [[value, '#57f06a']]], 2, { font: '700 52px Fredoka, "Arial Black", sans-serif', outlineWidth: 6 })
      cash.position.set(cx + base.sign.x, 6.2, F + base.sign.z) // over the sign
      return cash
    }
    const rateSign = swap(scene, null, paintRate(base.rate))
    const multiSign = swap(scene, null, paintMulti(base.cash))
    mine = { paintRate, paintMulti, rateSign, multiSign, rate: base.rate, multi: base.cash }
  })
  const crowd = BASES.npcs.map((npc) => bystander(scene, b, particles, npc))
  let last = 0
  return {
    pad,
    x: BASES.list[seat].x, // the local player's plot centre
    upgrades: pad.upgrades,
    sign,
    // The Upgrade Base sign: { cost, level } as text, and whether the player can pay.
    setUpgrade(info) {
      sign.show(info)
    },
    setUpgradeReady(on) {
      sign.mark.visible = on
    },
    // The weight and its sign leave the pad while the player lifts.
    setLifting(on) {
      lifting = on
      pad.weight.visible = pad.gain.visible = !on
    },
    // What is equipped: the model on the pad, its sign, and the next upgrade's price.
    setEquipped({ geometry, gain, cost }) {
      pad.weight.geometry = geometry
      pad.weight.position.y = -geometry.boundingBox.min.y
      pad.gain = swap(scene, pad.gain, pad.paintGain(gain))
      pad.gain.visible = !lifting
      pad.cost = swap(scene, pad.cost, pad.paintCost(cost))
    },
    // The player's sign and multiplier; repainted only when the text changes.
    setOwner({ rate, multi }) {
      if (rate !== mine.rate) {
        mine.rate = rate
        mine.rateSign = swap(scene, mine.rateSign, mine.paintRate(rate))
      }
      if (multi !== mine.multi) {
        mine.multi = multi
        mine.multiSign = swap(scene, mine.multiSign, mine.paintMulti(multi))
      }
    },
    update(elapsed) {
      const dt = Math.min(0.1, elapsed - last)
      last = elapsed
      for (const c of crowd) c.load.position.y = c.base + Math.abs(Math.sin(elapsed * 1.6 + c.phase)) * c.range
      sign.mark.position.y = 3.9 + Math.sin(elapsed * 3) * 0.14
      // The other seats: whoever the room has put there.
      const roster = net.roster()
      const held = new Map()
      roster?.players.forEach((p, id) => id !== roster.self && p.seat >= 0 && held.set(p.seat, p))
      for (const o of others) o.plot.show(held.get(o.seat), dt, elapsed)
    },
  }
}
