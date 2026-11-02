import { Mesh } from 'three'
import { TRAIN } from './config.js'
import { sfx } from './audio/index.js'
import { aimCamera } from './camera.js'
import { inputState } from './input.js'
import { player } from './player.js'
import { std } from './propkit.js'
import { weightGeometry } from './weightArt.js'

// The strength pad in front of the player's plot. Stepping on it takes the player over
// (player.drive, like a climb run): they walk to the centre, pick the equipped weight up and
// press it on their own, each rep paying its strength. STOP TRAIN or walking away ends it, and
// so does anything that resets the player; they have to leave the pad before it can start again.

// shop: the Treadmill Shop, which says what is equipped.
export function createTraining({ group, world, run, shop }) {
  const { bases } = world
  const { pad } = bases
  const { hud } = run
  const bar = new Mesh(undefined, std('#ffffff', { vertexColors: true, roughness: 0.6 }))
  bar.castShadow = true
  bar.frustumCulled = false
  bar.visible = false
  group.add(bar)

  let training = false
  let armed = true // off from starting until the player has left the pad
  let reps = 0 // goes up all the time, a whole number is a rep
  let boost = 0 // s left of the hand button's x2
  let holding = false // still holding the key that walked them on
  let set = 0 // reps since they started, for the note each one plays

  const liftAt = () => (1 - Math.cos(reps * Math.PI)) / 2 // a full press every two reps

  function start() {
    training = true
    armed = false
    reps = boost = set = 0
    holding = true
    sfx.trainStart()
    player.drive = tick
    player.velocity.x = player.velocity.y = player.velocity.z = 0
    player.grounded = true
    player.facing = TRAIN.facing
    run.setTraining(true)
    bases.setLifting(true)
    bar.geometry = weightGeometry(shop.equipped().id)
    bar.visible = true
    hud.setTraining(true)
    aimCamera(Math.PI, TRAIN.pitch)
    document.exitPointerLock?.() // STOP TRAIN and the hand are for clicking
  }

  function end() {
    training = false
    run.setTraining(false)
    bar.visible = false
    hud.setTraining(false)
  }

  function stop() {
    if (!training) return
    player.drive = null
    sfx.trainStop()
    end()
  }

  function press() {
    if (!training) return
    boost = TRAIN.boostTime
    hud.boosted()
    sfx.trainBoost()
  }

  function tick(dt) {
    const p = player.position
    if (inputState.jump) {
      inputState.jump = false
      press()
    }
    const moving = Math.hypot(inputState.move.x, inputState.move.z) > TRAIN.walkOff
    if (holding) holding = moving
    else if (moving) return stop()
    const t = Math.min(1, TRAIN.snap * dt)
    p.x += (pad.x - p.x) * t
    p.z += (pad.z - p.z) * t
    boost = Math.max(0, boost - dt)
    const before = Math.floor(reps)
    reps += TRAIN.reps * (boost > 0 ? TRAIN.boost : 1) * dt
    if (Math.floor(reps) > before) {
      const { strength } = shop.equipped()
      hud.strengthPop(run.addStrength(strength))
      sfx.rep(set++, boost > 0)
    }
  }

  hud.onTraining({ stop, press })

  return {
    stop,
    // The press, 0..1, for the animator; null when not lifting.
    lift: () => (training ? liftAt() : null),

    // Once a frame: the trigger and the bar.
    update() {
      if (training && player.drive !== tick) end() // a respawn or a trip took them off the pad
      if (training) {
        const lift = liftAt()
        bar.position.y = TRAIN.barY[0] + (TRAIN.barY[1] - TRAIN.barY[0]) * lift
        return
      }
      const d = Math.hypot(player.position.x - pad.x, player.position.z - pad.z)
      if (d > pad.radius) {
        if (!armed) bases.setLifting(false) // the weight goes back once they are out of its way
        armed = true
      } else if (armed && d < pad.radius - 0.3 && player.grounded && !player.drive && !run.busy()) start()
    },
  }
}
