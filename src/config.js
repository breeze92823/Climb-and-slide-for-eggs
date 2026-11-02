// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'climb-and-slide-for-eggs' // slug registered on bloxity.io
export const GAME_TITLE = 'Bowling Roll'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- Game server (net.js) -------------------------------------------------
// Hosted on Bloxity the matchmaker picks the server; `devServer` is `npm start` in the backend.
export const NET = {
  room: 'world',
  devServer: import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567',
  bootWait: 25000, // ms the game waits for the server's save before playing on the local copy
  devBootWait: 3000, // the same with no SDK (a local server answers at once, or is not running)
  saveDelay: 3000, // ms between a change and the save being sent
  poseEvery: 100, // ms between pose messages (the server drops anything faster than ~60)
  poseIdleEvery: 1000, // ms between pose messages while standing still
}

// --- Other players (remotePlayers.js) -----------------------------------------------------
export const REMOTE = {
  interpDelay: 0.15, // s remote players are drawn behind the newest update, so motion is smooth
  snapDistance: 6, // m: a bigger jump between updates (teleport, respawn) is not interpolated
  reselectEvery: 0.5, // s between choosing which players are drawn (nearest first)
  labelRange: 45, // m: name tags fade out beyond this
  labelHeight: 0.55, // m above the head
  bubbleHeight: 3.1, // m above the feet: over the name tag
  bubbleSeconds: 4, // Legion.SDK.chat.bubbleSeconds
}

// --- Bloxity ads and leaderboards (bloxity.js) ---------------------------------------------
export const ADS = {
  screens: true, // tell Boxity which screen is up so it can show banner ads on the edges
  rewarded: { placement: 'free-cash', seconds: 600, cooldown: 30 }, // Playtime window: a watched ad pays this many seconds of the current rate
}
// Declared once after init (the first declaration creates a board; Boxity's dashboard owns it
// afterwards). Boxity draws the leaderboard panel itself, from its toolbar.
export const LEADERBOARDS = [
  { id: 'best-climb', label: 'Best Climb', order: 'desc', mode: 'best', format: 'number', reset: 'none' },
  { id: 'rebirths', label: 'Rebirths', order: 'desc', mode: 'best', format: 'number', reset: 'none' },
  { id: 'strength', label: 'Strength', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
]

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
// The lobby (terrain.js): a sunken brick arena, walled on all four sides, with stepped
// voxel hills behind the walls. The climb leaves through a gap in the north wall.
export const LOBBY = {
  halfWidth: 57, // x extent of the arena floor
  north: -24, // z of the north wall
  south: 24, // z of the south wall
  wallHeight: 5, // purple brick face
  lip: 2.5, // green brick band on top of it (and on every terrace edge)
  gap: 5.4, // half-width of the opening in the north wall
  flankDepth: 16, // the wall blocks either side of the opening run this far north
  stripe: 0.22, // height of the red line along the foot of the walls
  floorTile: 1.3, // m per baseplate texture tile (two checks)
  brickTile: 2.2, // m per wall/terrace texture tile
  cell: 7, // m per terrace column
  reach: 300, // m the hills run out from the arena
  step: 3.2, // m per terrace height step
  firstTerrace: 11, // m of flat terrace behind the walls before the hills rise
  rise: 0.5, // hill rise per metre out
  maxHill: 62, // terrace height cap
  noise: 0.032, // terrace noise frequency, 1/m
  colors: {
    floor: { light: '#6fe23a', dark: '#62d632', grid: '#66d936', rim: '#2fa426', shine: '#94ec6c' },
    green: ['#49c81e', '#3bb819', '#35a816'],
    purple: ['#5c5280', '#524874', '#4a4069'],
    stripe: '#e8141c',
    lipLine: '#58e07a',
  },
}

// The climb (climb.js): stairs and a water slide side by side, running north up a
// forested ridge. `s` is metres north of the wall.
export const CLIMB = {
  length: 240,
  slope: 0.47, // rise per metre north
  water: [-3.7, -0.1], // x range of the slide
  stairs: [0.1, 3.7], // x range of the stairs
  ridge: 20, // half-width of the hillside
  bank: 0.16, // the hillside lifts this much per metre away from the climb
  ridgeFall: 1.0, // terraces either side drop this much per metre
  tread: 0.5, // m per stair
  scroll: 0.42, // tiles/s the slide water runs
  waterTile: 7, // m per water texture tile
  forestStep: 3.4, // m between hillside trees
  forestEdge: 8, // |x| the forest starts at
  colors: {
    water: { base: '#8ffcfb', deep: '#3fdcf6', foam: '#f2ffff' },
    stone: '#a9bcc0',
    stoneDark: '#8fa3a8',
    nose: '#e8eff0',
    rim: '#90a4a8',
    divider: '#9fb0b6',
    rail: '#ff5c5c',
    lip: '#f4f8f8',
    pool: '#35c4ff',
    bankLeft: '#58c048',
    bankRight: '#b6d8a8',
    bankStrip: '#94e878',
    gate: '#99a9ae',
    gateDark: '#6f7f85',
  },
}
export const climbY = (z) => (LOBBY.north - z) * CLIMB.slope

// A climb run (climbRun.js, climbHud.js). Strength is spent 1 per metre, so it sets how
// far a run reaches and tapping only gets there sooner. Metres are the HUD's numbers.
export const RUN = {
  metresPerS: 1.5, // HUD metres per metre of `s`, so the checkpoints read as in the reference
  strength: 56, // starting strength
  strengthScale: 1.65, // metres of climb per point: the reference's 56 strength fills a bar of 92
  strengthPerRun: 2, // strength gained each time the player lands
  speed: 4.5, // m/s climbed with no tapping (the reference's bar drops 4.5/s)
  tapBoost: 1.6, // m/s added per tap
  maxBoost: 13, // m/s
  boostDecay: 5, // m/s lost per second
  autoRate: 5, // taps/s with Auto Climb on
  lowStrength: 0.2, // share of the bar under which it turns red
  milestone: 50, // m between the little distance pops
  luck: [0.0011, 0.0000057], // luck = 1 + a*m + b*m^2, fitted to the reference's 1.05x..1.14x
  hatchBonus: 1, // added to the luck shown on the hatch orb (the reference's 1.14x hatches at 2.14x)
  upgradeChance: 0.25, // times luck: chance the egg comes out one tier better
  hop: 0.45, // s to jump from the stairs to the slide
  hopHeight: 1.4, // m
  waterLift: 0.16, // m the slide's water sits above the climb
  slideAccel: 20, // m/s^2
  slideMax: 28, // m/s
  launchSpeed: 14, // m/s kept flying off the foot of the slide
  launchUp: 5, // m/s
  orbDelay: 0.9, // s after landing the hatch orb opens
  orbTime: 2.4, // s it lasts
  hotbar: 8, // slots, the dumbbell included
  saveKey: 'climb-slide-run', // saves.js section (browser + backend)
  devBest: 88, // `npm run dev` with no save starts here, so the YOUR BEST marker shows
  // Checkpoints, lowest first. `m` is where the tier starts, `meter` its share of the rainbow
  // meter, `egg` an INDEX egg, `shell` the colours of the egg held in 3D. The climb ends at
  // 360 m, so only the first two can be reached until it is made longer.
  tiers: [
    { name: 'Common', m: 10, luck: 1, color: '#ffffff', meter: 75, bar: '#f2f2f2', egg: 'basicEgg', shell: ['#fbe8df', '#f6ddd2', '#ecd2c6'] },
    { name: 'Uncommon', m: 300, luck: 2, color: '#a6ff5c', meter: 115, bar: '#a4f2a8', egg: 'toxicEgg', shell: ['#93ee3c', '#7fdc34', '#6cc72c'] },
    { name: 'Rare', m: 700, luck: 4, color: '#52c8ff', meter: 115, bar: '#58c4f4', egg: 'batEgg', shell: ['#6242e0', '#4f33c4', '#5a3ad4'] },
    { name: 'Epic', m: 1200, luck: 8, color: '#e65cff', meter: 225, bar: '#d95ce8', egg: 'cloudEgg', shell: ['#dcd6ff', '#c9c0ff', '#b9aeff'] },
    { name: 'Legendary', m: 2000, luck: 16, color: '#ffc21f', meter: 225, bar: 'linear-gradient(0deg, #ff9a2e, #ffe45c)', egg: 'jungleEgg', shell: ['#ffd23a', '#e6b02c', '#c49422'] },
    { name: 'Mythic', m: 3200, luck: 32, color: '#ff5560', meter: 50, bar: '#e8505a', egg: 'lavaEgg', shell: ['#ff8a1f', '#d8541c', '#3a2a30'] },
  ],
}

// Training on the player's pad (training.js). Stepping on it lifts the barbell until they stop.
export const TRAIN = {
  reps: 3, // a second, each paying the equipped weight's strength: the reference goes from 100 to 312 in 35 s on +2
  boost: 2, // reps are multiplied by this for `boostTime` s after a press of the hand button
  boostTime: 1, // s
  snap: 10, // 1/s the player slides to the pad's centre
  walkOff: 0.2, // stick travel that counts as walking away
  facing: Math.PI - 0.3, // yaw lifting, a little off the camera as in the reference
  pitch: 0.42, // the camera's, looking south over the pad at the plot
  barY: [2.02, 2.38], // m above the feet, arms bent and locked out
  popArea: { x: [0.3, 0.68], y: [0.28, 0.78] }, // where "+2 Strength" appears, share of the screen
}

// The Treadmill Shop on the Upgrades pad (weightShop.js), weakest first. `strength` is paid per
// rep, `cash` and `coin` are the two prices, and each id has a model in weightArt.js. Pancake on
// and the Strawberry's 1K$ are the reference's numbers; what it cuts off is filled in between.
const RARITY = { Common: '#d8d8d8', Uncommon: '#a6ff5c', Rare: '#52c8ff', Epic: '#e65cff', Legendary: '#ffc21f', Mythic: '#ff5560', Ancient: '#7cf0d8', Divine: '#ffe05a', Secret: '#e8e8e8', Cosmic: '#a98aff', Ultimate: '#ff8a3c', Exotic: '#5cffb0', Dessert: '#ff9ad0', Titanium: '#f4f4f4', GOD: '#5a68ff' }
export const WEIGHTS = {
  saveKey: 'climb-slide-weights', // saves.js section (browser + backend)
  list: [
    { id: 'dumbbell', name: 'Dumbbell', rarity: 'Common', strength: 1, cash: 0, coin: 0 },
    { id: 'sphere', name: 'Dumbbell Sphere', rarity: 'Uncommon', strength: 2, cash: 100, coin: 3 },
    { id: 'strawberry', name: 'Strawberry Dumbbell', rarity: 'Rare', strength: 5, cash: 1e3, coin: 5 },
    { id: 'royal', name: 'Royal Dumbbell', rarity: 'Epic', strength: 25, cash: 15e3, coin: 8 },
    { id: 'watermelon', name: 'Watermelon Dumbbell', rarity: 'Legendary', strength: 120, cash: 200e3, coin: 12 },
    { id: 'lava', name: 'Lava Dumbbell', rarity: 'Mythic', strength: 1500, cash: 3e6, coin: 15 },
    { id: 'crystal', name: 'Crystal Dumbbell', rarity: 'Ancient', strength: 12e3, cash: 40e6, coin: 20 },
    { id: 'pancake', name: 'Pancake Dumbbell', rarity: 'Divine', strength: 60e3, cash: 350e6, coin: 25 },
    { id: 'frozen', name: 'Frozen Dumbbell', rarity: 'Secret', strength: 300e3, cash: 2e9, coin: 35 },
    { id: 'rocket', name: 'Rocket', rarity: 'Cosmic', strength: 1.5e6, cash: 15e9, coin: 49 },
    { id: 'anvil', name: 'Anvil Dumbbell', rarity: 'Ultimate', strength: 40e6, cash: 500e9, coin: 99 },
    { id: 'golden', name: 'Golden Dumbbell', rarity: 'Exotic', strength: 1e9, cash: 20e12, coin: 299 },
    { id: 'donut', name: 'Donut Dumbbell', rarity: 'Dessert', strength: 60e9, cash: 800e12, coin: 799 },
    { id: 'cake', name: 'Birthday Dumbbell', rarity: 'Dessert', strength: 3.1e12, cash: 10e18, coin: 1399 },
    { id: 'car', name: 'Titanium Car', rarity: 'Titanium', strength: 15.6e12, cash: 100e18, coin: 1539 },
    { id: 'plane', name: 'Passenger Plane', rarity: 'GOD', strength: 78.1e12, cash: 1e21, coin: 1939 },
  ].map((w) => ({ ...w, color: RARITY[w.rarity] })),
}

export const NATURE = {
  leaves: { rim: '#3cf04a', base: '#1ccc30', dark: '#12a024', deep: '#0a7a1a' },
  trunk: '#7a3c20',
  oakBark: ['#c4683a', '#a9542c'],
  hillTrees: 46, // pines scattered over the east, south and west terraces
}

// Set pieces on the arena floor (world metres).
export const STANDS = {
  stallScale: 0.62, // the shop and sell stalls are drawn in stall units, scaled to this
  shop: { x: -11.8, z: -22.2 },
  sell: { x: 8.8, z: -22.2 },
  eggs: { x: -17.4, z: -22 },
  jellyfish: { x: 14.8, z: -21.8 },
  portal: { x: -34, z: -22.6 },
  paw: { x: 44, z: -22.4 },
  gifts: { x: -54, z: -19 },
  panels: [{ x: 55.6, z: -16 }, { x: 55.6, z: -9.5 }], // the two blue boards on the east wall
}

// Player plots along the south wall, east to west. The owner names, rates and pets
// are the sample data from the reference screenshots; live plots will come from the server.
export const BASES = {
  width: 22,
  front: 10, // z of the front fence
  back: 22.6, // z of the back fence
  gateWidth: 5, // gap in the front fence
  rail: 2.1, // m between fence posts
  padOffset: { x: 2.4, z: -11 }, // strength pad, relative to the plot's front centre
  padRadius: 3.4,
  upgrades: { x: 1.4, z: -17 }, // the owner's upgrades pad
  fences: {
    checker: { post: ['#f2f2f2', '#0c1420'], rail: '#0c1420' },
    red: { post: ['#c8141c', '#a00f16'], rail: '#d8161e' },
    wood: { post: ['#8d97a8', '#b8622e'], rail: '#d9733a' },
  },
  list: [
    {
      x: 43.5, fence: 'red', name: "xahahaha123's Base", rate: '87.7B$/s', nameColor: '#ffffff', signSize: 3.4, weight: 'dumbbell',
      portrait: { ring: '#6fc4ff', bg: '#bfe6ff', skin: '#f6e7d8', hair: '#f4f4f4' },
      cash: 'x212.40',
      pets: [
        ['polarEgg', 9.5, 5, 1.6, 0, 'Polarbear Egg', 'SPECIAL', 'Ready!'],
        ['cyanDog', 4, 6, 1.5, 0.4, 'Frost Dog', 'SPECIAL', '$84.2M/s'],
        ['whiteCat', 1, 3.5, 1.3, 2.4, 'Snow Cat', 'SPECIAL', '$12.1M/s'],
        ['cyanDog', -2.5, 6.5, 1.2, -0.3, 'Frost Dog', 'Common', '$2.1K/s'],
        ['duck', -5.5, 3.5, 1.5, 0.6, 'Gold Duck', 'CYBER', '$220M/s'],
        ['whiteCat', -8.5, 6, 1.3, 1, 'Snow Cat', 'Common', '$1.4K/s'],
      ],
    },
    {
      x: 14.5, fence: 'checker', name: "Wiinnie728's Base", rate: '12.7T$/s', nameColor: '#ff3b3b', signSize: 4.2, weight: null,
      portrait: { ring: '#ff3b3b', bg: '#ff8a8a', skin: '#f7f0e4', hair: '#b83a1e' },
      cash: 'x1331.79',
      pets: [
        ['mammoth', -1.6, 7.4, 1.32, 1.05, 'Mammoth', 'LEGEND', '$1.2T/s'],
        ['gorilla', 8.3, 4.4, 1, 0.6, 'Gorilla', 'CYBER', '$399.5B/s'],
        ['gorilla', 4.3, 6.5, 1.15, -0.2, 'Gorilla', 'CYBER', '$399.5B/s'],
        ['gorilla', -6, 4.8, 1.2, -0.4, 'Gorilla', 'CYBER', '$399.5B/s'],
        ['gorilla', -9.2, 7, 1, 0.3, 'Gorilla', 'CYBER', '$399.5B/s'],
        ['diamond', 1.4, 3.8, 1.1, 0.2, 'Diamond Seal', 'SPECIAL', '$199.8B/s'],
        ['seal', 6.3, 2.7, 1.1, 2.2, 'Seal', 'SPECIAL', '$199.8B/s'],
        ['dragon', -3.8, 2.6, 1.05, 0.2, 'Radioactive Dragon', 'SPECIAL', '$240B/s'],
        ['shark', -8.7, 2.3, 1.1, 0.5, 'Whale', 'SPECIAL', '$241.3B/s'],
        ['puffer', 9.3, 1.6, 1.1, 0.3, 'Radioactive Pufferfish', 'Titanium', '$47/s'],
        ['minotaur', 2.8, 8.5, 1.1, 0.1, 'Minotaur', 'CYBER', '$399.5B/s'],
      ],
    },
    {
      x: -14.5, fence: 'wood', name: 'Your base', rate: '50$/s', nameColor: '#ff5cff', signSize: 3.8, weight: 'dumbbell', // rate and cash are live, from baseFarm.js
      portrait: { ring: '#d070ff', bg: '#f0c8ff', skin: '#f2c79a', hair: '#6a4426', shades: true },
      cash: 'x1.00',
      owner: true,
      sign: { x: 8.8, z: 0.7 },
      pets: [],
    },
    {
      x: -43.5, fence: 'wood', name: "Nics_2984's Base", rate: '21.2M$/s', nameColor: '#ffffff', signSize: 3, weight: 'crystal',
      portrait: { ring: '#d8d8e8', bg: '#efe8f4', skin: '#fbe3dc', hair: '#ececf4' },
      cash: 'x18.60',
      pets: [
        ['trex', 3, 5, 1.1, -1.1, 'T-Rex', 'SPECIAL', '$8.1M/s'],
        ['trex', -4.5, 6, 1.1, -1.2, 'T-Rex', 'SPECIAL', '$8.1M/s'],
        ['minotaur', 8.2, 7, 0.9, 0.3, 'Minotaur', 'Common', '$2.2M/s'],
        ['puffer', -8, 3.5, 0.8, 0.2, 'Pufferfish', 'Common', '$1.5M/s'],
        ['pigeon', 0, 2.5, 0.9, 0.5, 'Pigeon', 'Common', '$600K/s'],
      ],
    },
  ],
  // Other players standing around the arena.
  npcs: [
    { name: 'Wiinnie728', x: 16.9, z: -1, yaw: 2.4, crates: 3 },
    { name: 'Mikey', x: 32, z: 8, yaw: 1.2, crates: 0 },
  ],
}

export const SPAWN = { x: 0, y: 0.05, z: -12 }
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z)

// --- The player's plot (baseFarm.js) ----------------------------------------------
export const FARM = {
  income: 50, // $/s every base earns, before any pets
  offlineCap: 3600, // s of pet income paid for time away (the reference's $4.9M at 1.4K$/s)
  saveKey: 'climb-slide-farm', // saves.js section (browser + backend)
  margin: 1.6, // m eggs and pets keep from the fence
  placeReach: 3.5, // m ahead of the player the ghost egg stands
  hatchReach: 4, // m from an egg the Hatch prompt shows
  spacing: 2.6, // m between placed eggs
  eggScale: 1.7,
  petScale: 0.11, // pet models are drawn in Index units
  petSpeed: 1.6, // m/s
  hatchTime: 0.9, // s an egg shakes before it opens
  weights: [70, 25, 5], // chance of each of an egg's pets, commonest first
  maxEggs: 20, // eggs growing on the plot at once, the reference's (2/20)
  autoHatchCoin: 25, // the Auto Hatch Eggs price; no paid currency exists yet
}

// The Upgrade Base sign on the player's plot (baseFarm.js). Levels buy room for more active pets.
export const BASE_UPGRADE = {
  cost: 5e6, // $ of the first level, the reference's number
  growth: 2.5, // each level costs this much more
  levels: 10, // the reference's 0/10
  slots: 10, // pets active before any upgrade, the reference's 5/10
  slotsPerLevel: 2,
  reach: 3.6, // m from the sign the Upgrade prompt shows
}

// --- Rebirth (rebirthWindow.js) -----------------------------------------------------
// Rebirth n pays xn+1 cash and spends only its price: pets, strength and eggs stay.
export const REBIRTH = {
  cost: 250e3, // $ of the first rebirth, the reference's number
  growth: 3, // each rebirth costs this much more
  coin: 2, // Skip Rebirth's price; no paid currency exists yet
  saveKey: 'climb-slide-rebirth', // saves.js section (browser + backend)
}

// --- Playtime Rewards (playtimeWindow.js) ----------------------------------------------
// Session only: leaving resets it. `at` is s played, `cash` pays that many seconds of the
// current rate, `pet` gives that pet. The spacing of the last seven is the reference's timers.
export const PLAYTIME = {
  coin: 95, // Skip All's price; no paid currency exists yet
  tier: { name: 'Special', color: '#ffd24a' }, // the pets below, which no egg holds
  pets: [
    { id: 'koala', name: 'Koala', cash: 200 },
    { id: 'lion', name: 'Lion', cash: 500 },
    { id: 'snail', name: 'Snail', cash: 1200 },
    { id: 'ostrich', name: 'Ostrich', cash: 3000 },
    { id: 'sphinx', name: 'Sphinx', cash: 8000 },
    { id: 'capybara', name: 'Capybara', cash: 900 },
    { id: 'bear', name: 'Bear', cash: 15000 },
    { id: 'whale', name: 'Whale', cash: 60000 },
  ],
  rewards: [
    { at: 30, cash: 60 },
    { at: 60, pet: 'frog' },
    { at: 120, cash: 120 },
    { at: 180, pet: 'koala' },
    { at: 300, cash: 180 },
    { at: 600, pet: 'lion' },
    { at: 900, cash: 300 },
    { at: 1500, pet: 'snail' },
    { at: 2400, cash: 600 },
    { at: 3300, pet: 'ostrich' },
    { at: 5100, cash: 900 },
    { at: 6900, pet: 'sphinx' },
  ],
}

// --- Lobby HUD (lobbyHud.js) -----------------------------------------------------
export const LOBBY_HUD = {
  holdTime: 2, // seconds E (or a press on the prompt) is held for Shop, Sell and Upgrade
  incomeEvery: 1, // s between payouts
  saveKey: 'climb-slide-cash', // saves.js section (browser + backend)
  saveEvery: 5, // s
  devCash: 3000000, // `npm run dev` with no save starts here, as in the reference
  eventEvery: 3600, // s of the Next Event countdown; nothing happens at zero yet
  play: { x: 1.9, z: -20 }, // where the Play tab stands the player, at the foot of the stairs
}

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
export const MODES = ['character', 'player']
export const START_MODE = 'character'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 8, // m/s
  sprintSpeed: 14, // m/s with Shift held
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -6, // sank this far: respawn
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // capsule the character controller moves

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0 }
export const FOG = { near: 260, far: 900 }
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    zenith: '#00d2f6',
    horizon: '#a4f0f0',
    cloud: '#f6f8fc',
    sunColor: '#fff6e6',
    // Sun + hemi + env sum to about pi on a flat top, which shows a surface's own
    // colour: there is no tone mapping, so the bright brick palette stays exact.
    sunIntensity: 1.85,
    sunElevation: 52, // degrees above the horizon
    sunAzimuth: 135, // degrees, 0 = from +Z; the sun stands in the north-east
    hemiSky: '#dcecff',
    hemiGround: '#9ac08a',
    hemiIntensity: 1.3,
    envIntensity: 0.3,
    lampIntensity: 0,
    stars: 0,
    exposure: 1,
  },
  night: {
    zenith: '#050b22',
    horizon: '#24345e',
    cloud: '#2e3a60',
    sunColor: '#9fb4ff', // the moon
    sunIntensity: 0.55,
    sunElevation: 38,
    sunAzimuth: -60,
    hemiSky: '#3a4c80',
    hemiGround: '#1a1a22',
    hemiIntensity: 0.35,
    envIntensity: 0.25,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.15,
  },
}
export const LIGHT = {
  shadowRange: 62, // half-width of the sun's shadow box around the player
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f6fd0', hair: '#4a2f1c' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35, remotes: 4 },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6, remotes: 8 },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1, remotes: 16 },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1, remotes: 24 },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6, remotes: 6 } // remotes = other players drawn at once

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles), remotes: Math.min(p.remotes, cap.remotes) }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1400,
  startPitch: 0.26, // radians above the horizon (low chase cam)
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 9, // resting boom length, m
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 26,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  fullscreen: { def: 'false', type: 'bool' },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06, toSlide: 0.16 }, // s to blend a pose change
  // Arms written over the locomotion pose while the player carries an egg.
  carry: {
    overhead: { ArmL1: { x: deg(-168), z: deg(14) }, ArmR1: { x: deg(-168), z: deg(-14) }, ArmL2: { x: deg(16) }, ArmR2: { x: deg(16) } },
    hold: { ArmR1: { x: deg(-62), z: deg(-10) }, ArmR2: { x: deg(18) } },
  },
  // Pressing the barbell: the arms move between these two poses.
  lift: {
    bent: { ArmL1: { x: deg(-170), z: deg(40) }, ArmR1: { x: deg(-170), z: deg(-40) }, ArmL2: { x: deg(58) }, ArmR2: { x: deg(58) } },
    locked: { ArmL1: { x: deg(-172), z: deg(16) }, ArmR1: { x: deg(-172), z: deg(-16) }, ArmL2: { x: deg(12) }, ArmR2: { x: deg(12) } },
  },
  // Sitting back on the slide, egg still held up.
  slide: {
    LegL1: { x: deg(-82) }, LegR1: { x: deg(-82) }, LegL2: { x: deg(14) }, LegR2: { x: deg(14) }, Spine1: { x: deg(-16) },
  },
}

// --- Index window (petIndex.js, indexWindow.js) --------------------------------
// One card per pet per tab: 20 pets x 5 tabs = the 100 in the title. `tier` is the card
// colour of the egg's row (indexWindow.css), `cash` the pet's $/s, `bonus` the tab's +%$.
// Everything past Basic Egg, Bat Egg, the Parrot, the Bat and Gold's +25% is a placeholder
// until the real roster exists; models are in petArt.js under the same ids.
export const INDEX = {
  perEggBonus: 10, // +% Cash Multi for each egg completed in a tab
  saveKey: 'climb-slide-index', // saves.js section (browser + backend)
  tabs: [
    { id: 'normal', label: 'NORMAL', bonus: 0 },
    { id: 'gold', label: 'GOLD', bonus: 25 },
    { id: 'diamond', label: 'DIAMOND', bonus: 50 },
    { id: 'radioactive', label: 'RADIOACTIVE', bonus: 100 },
    { id: 'rainbow', label: 'RAINBOW', bonus: 200 },
  ],
  eggs: [
    { id: 'basicEgg', name: 'Basic Egg', tier: 'white', pets: [{ id: 'chick', name: 'Chick', cash: 5 }, { id: 'parrot', name: 'Parrot', cash: 15 }, { id: 'penguin', name: 'Penguin', cash: 30 }] },
    { id: 'batEgg', name: 'Bat Egg', tier: 'blue', pets: [{ id: 'bat', name: 'Bat', cash: 400 }, { id: 'owl', name: 'Owl', cash: 650 }, { id: 'raccoon', name: 'Raccoon', cash: 1000 }] },
    { id: 'cloudEgg', name: 'Cloud Egg', tier: 'purple', pets: [{ id: 'sheep', name: 'Sheep', cash: 1600 }, { id: 'fox', name: 'Fox', cash: 2500 }, { id: 'pegasus', name: 'Pegasus', cash: 4000 }] },
    { id: 'jungleEgg', name: 'Jungle Egg', tier: 'gold', pets: [{ id: 'monkey', name: 'Monkey', cash: 6500 }, { id: 'tiger', name: 'Tiger', cash: 10000 }, { id: 'toucan', name: 'Toucan', cash: 16000 }] },
    { id: 'lavaEgg', name: 'Lava Egg', tier: 'red', pets: [{ id: 'imp', name: 'Imp', cash: 25000 }, { id: 'phoenix', name: 'Phoenix', cash: 40000 }, { id: 'dragon', name: 'Dragon', cash: 65000 }] },
    { id: 'toxicEgg', name: 'Frog Egg', tier: 'green', pets: [{ id: 'frog', name: 'Frog', cash: 100 }, { id: 'slime', name: 'Slime', cash: 160 }, { id: 'alien', name: 'Alien', cash: 250 }] },
    { id: 'secretEgg', name: 'Secret Egg', tier: 'rainbow', pets: [{ id: 'jellyfish', name: 'Jellyfish', cash: 75000 }, { id: 'kraken', name: 'Kraken', cash: 150000 }] },
  ],
  // `npm run dev` with no save starts here, so the window shows the reference's 10/100.
  devSeed: {
    eggs: ['basicEgg', 'batEgg'],
    pets: {
      normal: ['parrot'],
      gold: ['bat'],
      diamond: ['chick', 'parrot', 'penguin'],
      radioactive: ['chick', 'parrot'],
      rainbow: ['chick', 'owl', 'raccoon'],
    },
  },
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// --- Daily Rewards (dailyWindow.js) ------------------------------------------------------
// One reward a day (the UTC date), day 1 to 7, then it starts over. `cash` pays that many seconds
// of the current rate, `pet` is one of PLAYTIME.pets, `paw` is a count of paw coins, which have
// no use yet. `op` puts the OP! ribbon on the card. The days' order is the reference's; the
// amounts are placeholders.
export const DAILY = {
  saveKey: 'climb-slide-daily', // saves.js section (browser + backend)
  days: [
    { cash: 100, label: 'x100' },
    { pet: 'capybara', op: true },
    { paw: 1 },
    { pet: 'sphinx', op: true },
    { cash: 1000, label: 'x1K' },
    { pet: 'bear', op: true },
    { pet: 'whale', op: true },
  ],
}

// --- Sell Animals (sellWindow.js) --------------------------------------------------------
// A pet sells for its $/s times `mult`. Only spare pets sell: the ones on the plot are safe.
// The reference's Bat sold for 22.5K$; the multiplier is a placeholder.
export const SELL = {
  mult: 50,
  saveKey: 'climb-slide-sell', // saves.js section (browser + backend)
}

// --- Trail Shop (trailShop.js, trailFx.js) -----------------------------------------------
// A trail multiplies the strength gained (a run's and every rep's), weakest first. Green, Blue,
// Pink, the Black's Robux price and White / Rainbow with their multipliers and prices are the
// reference's; the trails between them and the prices past the Pink are placeholders. `color` is
// '#rrggbb' or 'rainbow'.
const TRAIL_RARITY = { Uncommon: '#a6ff5c', Rare: '#52c8ff', Epic: '#e65cff', Legendary: '#ffc21f', Mythic: '#ff5560', Ancient: '#7cf0d8', Secret: '#e8e8e8', Exotic: '#5cffb0', Ultimate: '#ff8a3c', Divine: '#ffe05a', SPECIAL: '#c040e0' }
export const TRAILS = {
  saveKey: 'climb-slide-trails', // localStorage, until the backend has fields for it
  length: 22, // points of the ribbon
  every: 0.035, // s between the points
  height: 0.9, // m above the feet
  width: 0.34, // m, at the player
  list: [
    { id: 'green', name: 'Green', rarity: 'Uncommon', multi: 1.1, cash: 100e3, coin: 39, color: '#35e04a' },
    { id: 'blue', name: 'Blue', rarity: 'Rare', multi: 1.2, cash: 7.5e6, coin: 79, color: '#2aa8ff' },
    { id: 'pink', name: 'Pink', rarity: 'Epic', multi: 1.3, cash: 350e6, coin: 119, color: '#ff5cc8' },
    { id: 'purple', name: 'Purple', rarity: 'Epic', multi: 1.4, cash: 5e9, coin: 149, color: '#a45cff' },
    { id: 'red', name: 'Red', rarity: 'Legendary', multi: 1.5, cash: 90e9, coin: 199, color: '#ff3b3b' },
    { id: 'orange', name: 'Orange', rarity: 'Legendary', multi: 1.6, cash: 2e12, coin: 249, color: '#ff9a2e' },
    { id: 'yellow', name: 'Yellow', rarity: 'Mythic', multi: 1.7, cash: 40e12, coin: 299, color: '#ffe03a' },
    { id: 'cyan', name: 'Cyan', rarity: 'Mythic', multi: 1.8, cash: 800e12, coin: 349, color: '#3ae8e8' },
    { id: 'lime', name: 'Lime', rarity: 'Ancient', multi: 1.9, cash: 15e15, coin: 399, color: '#b6ff3a' },
    { id: 'teal', name: 'Teal', rarity: 'Ancient', multi: 2, cash: 300e15, coin: 449, color: '#20c9a6' },
    { id: 'silver', name: 'Silver', rarity: 'Secret', multi: 2.1, cash: 6e18, coin: 499, color: '#c4ccd8' },
    { id: 'gold', name: 'Gold', rarity: 'Exotic', multi: 2.2, cash: 120e18, coin: 549, color: '#ffc21f' },
    { id: 'ember', name: 'Ember', rarity: 'Ultimate', multi: 2.3, cash: 2e21, coin: 599, color: '#ff6a1f' },
    { id: 'black', name: 'Black', rarity: 'Ultimate', multi: 2.4, cash: 40e21, coin: 675, color: '#2b2b33' },
    { id: 'white', name: 'White', rarity: 'Divine', multi: 2.5, cash: 800e21, coin: 979, color: '#f4f6fa' },
    { id: 'rainbow', name: 'Rainbow', rarity: 'SPECIAL', multi: 3, cash: 1e24, coin: 1539, color: 'rainbow' },
  ].map((t) => ({ ...t, rarityColor: TRAIL_RARITY[t.rarity] })),
}
