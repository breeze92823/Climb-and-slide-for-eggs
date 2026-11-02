import { GOALS, STANDS } from './config.js'
import { addCoins } from './coins.js'
import { sfx } from './audio/index.js'
import { formatCash } from './lobbyHud.js'
import { petInfo } from './baseFarm.js'
import { player } from './player.js'
import { clock } from './playtimeWindow.js'
import { screenPoint } from './stallPrompts.js'
import * as saves from './saves.js'

// The rewards on the lobby's set pieces (GOALS in config): the gift pile on a repeating timer, the
// paw coin for eggs hatched, the jellyfish for a big price, the T-Rex Egg for hours played and the
// portal it opens. Each sign shows its progress; near one, E or the prompt claims it.
const GREEN = '#57f06a'
const WHITE = '#ffffff'
const PROMPT_Y = 1.2 // m: under the signs, which show the progress
const done = (save, id) => save.done.includes(id)

function load() {
  const save = { played: 0, hatched: 0, giftAt: GOALS.gift.every, paw: 0, done: [] }
  try {
    Object.assign(save, saves.load(GOALS.saveKey))
  } catch {
    // No storage, or a bad save: start from the default.
  }
  return save
}

// signs: the lobby's live signs (world.signs). farm: takes the pets, and reports hatches.
export function createGoals({ hud, camera, farm, run, signs, bursts }) {
  const save = load()
  const store = () => {
    try {
      saves.store(GOALS.saveKey, save)
    } catch {
      // Storage blocked: the progress lasts this session.
    }
  }

  const burst = ({ x, z }, color) => bursts.emit({ count: 40, pos: [x, 1.6, z], spread: [1.4, 1.2, 1.4], radial: 3.5, vel: [0, 2, 0], life: 0.9, size: 0.34, color: '#ffffff', color2: color })
  // A pet reward, with its name in the toast.
  function givePet(id) {
    farm.give(id)
    hud.toast(`You got ${petInfo(id).name}!`)
  }

  const nextPaw = () => GOALS.paw[save.paw]
  const giftLeft = () => save.giftAt - save.played
  const passLeft = () => GOALS.pass.time - save.played

  // Each goal: where it is, its prompt (text, plus ready: holding E claims it) and its sign.
  const goals = [
    {
      at: { x: STANDS.gifts.x + 2.4, z: STANDS.gifts.z + 0.9 },
      prompt: () => (giftLeft() <= 0 ? { text: 'Claim Gift', ready: true } : { text: `Gift in ${clock(giftLeft())}` }),
      claim() {
        const cash = hud.rate() * GOALS.gift.cash
        hud.addCash(cash)
        addCoins(GOALS.gift.coins)
        save.giftAt = save.played + GOALS.gift.every
        hud.toast(`+${formatCash(cash)}$ and ${GOALS.gift.coins} coins!`)
      },
      sign: () => signs.gift([[['FREE ITEM', '#58c8ff']], [giftLeft() <= 0 ? ['READY!', GREEN] : [clock(giftLeft()), WHITE]]]),
    },
    {
      at: STANDS.paw,
      prompt() {
        const step = nextPaw()
        if (!step) return { text: 'All badges won' }
        return save.hatched >= step.eggs ? { text: `Claim ${petInfo(step.pet).name}`, ready: true } : { text: `Hatch ${step.eggs} Eggs` }
      },
      claim() {
        givePet(nextPaw().pet)
        save.paw++
      },
      sign() {
        const step = nextPaw()
        signs.badges.paw.visible = !!step && save.hatched >= step.eggs
        signs.paw(step
          ? [[['ANIMAL BADGE: ', '#ffd24a'], [petInfo(step.pet).name, WHITE]], [[`Hatch Eggs ${Math.min(save.hatched, step.eggs)}/${step.eggs}`, WHITE]]]
          : [[['ANIMAL BADGE', '#ffd24a']], [['All Won!', GREEN]]])
      },
    },
    {
      at: STANDS.jellyfish,
      prompt() {
        if (done(save, 'jelly')) return { text: 'Already yours' }
        const { price } = GOALS.jellyfish
        return hud.cash() >= price ? { text: 'Buy Jellyfish', ready: true } : { text: `Need $${formatCash(price)}` }
      },
      claim() {
        if (!hud.spend(GOALS.jellyfish.price)) return false
        givePet(GOALS.jellyfish.pet)
        save.done.push('jelly')
      },
      sign: () => signs.jellyfish(done(save, 'jelly') ? ['Yours!', GREEN] : [`$${formatCash(GOALS.jellyfish.price)}`, GREEN]),
    },
    {
      at: STANDS.eggs,
      prompt() {
        if (done(save, 'pass')) return { text: 'Already claimed' }
        return passLeft() <= 0 ? { text: 'Claim T-Rex Egg', ready: true } : { text: `Play ${clock(passLeft())}` }
      },
      claim() {
        givePet(GOALS.pass.pet)
        save.done.push('pass')
      },
      sign() {
        signs.badges.pass.visible = !done(save, 'pass') && passLeft() <= 0
        if (done(save, 'pass')) return signs.pass([[['T-Rex Egg Claimed', GREEN]], [['The Portal Is Open', WHITE]]])
        signs.pass([[['Free T-Rex Egg', '#ffb84a']], [passLeft() <= 0 ? ['READY!', GREEN] : [`Play ${clock(passLeft())}`, WHITE]]])
      },
    },
    {
      at: STANDS.portal,
      prompt() {
        if (!done(save, 'pass')) return { text: 'Obtain T-Rex Egg' }
        return done(save, 'portal') ? { text: 'Green World', tap: () => hud.comingSoon('Green World') } : { text: 'Enter Portal', ready: true }
      },
      sound: sfx.portal,
      claim() {
        save.done.push('portal')
        farm.refresh()
        hud.toast(`Green World blessing: x${GOALS.portal.multi} cash forever!`)
      },
      sign: () => signs.portal(!done(save, 'pass') ? null : done(save, 'portal') ? [[[`x${GOALS.portal.multi} Cash Forever`, GREEN]]] : [[['Portal Open!', GREEN]]]),
    },
  ]

  function claim(goal) {
    if (goal.claim() === false) return
    ;(goal.sound ?? sfx.gift)()
    store()
    goal.sign()
    burst(goal.at, GREEN)
  }

  farm.onHatch(() => {
    save.hatched++
    store()
  })
  farm.setMulti(() => (done(save, 'portal') ? GOALS.portal.multi : 1))

  for (const goal of goals) goal.sign()
  let saveTimer = 0
  let second = Math.floor(save.played)
  return {
    // Once a frame; dt is 0 in an ad break and the loop stops in a hidden tab.
    update(dt) {
      save.played += dt
      saveTimer += dt
      if (saveTimer >= GOALS.saveEvery) {
        saveTimer = 0
        store()
      }
      if (Math.floor(save.played) !== second) {
        second = Math.floor(save.played)
        for (const goal of goals) goal.sign()
      }
      const p = player.position
      const free = run.state() === 'idle' && !player.drive
      goals.forEach((goal, i) => {
        const near = free && Math.hypot(goal.at.x - p.x, goal.at.z - p.z) < GOALS.reach
        const pt = near ? screenPoint(camera, goal.at.x, PROMPT_Y, goal.at.z) : null
        if (!pt) return hud.prompt(null, `goal${i}`)
        const { text, ready, tap } = goal.prompt()
        hud.prompt({ ...pt, text, hold: !!ready, act: ready ? () => claim(goal) : tap ?? sfx.deny }, `goal${i}`)
      })
    },
    // Dev: moves the clock on.
    skip: (s) => (save.played += s),
    state: () => structuredClone(save),
  }
}
