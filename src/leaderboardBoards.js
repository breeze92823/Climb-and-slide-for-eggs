import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import { LEADERBOARD_BOARDS } from './config.js'
import * as bloxity from './bloxity.js'
import { formatCash } from './lobbyHud.js'
import { fontReady } from './propkit.js'

// The two blue boards on the east wall, drawn live from the Bloxity leaderboards (global only):
// rank, the player's Bloxity profile picture, name and score. The frame is built in stands.js; this
// adds the painted faces over it. Each board repaints when its rows arrive (and on a timer after).

const FONT = '"Fredoka", "Arial Black", sans-serif'
const FACE = { w: 4.5, h: 2.6, y: 2, z: 0.235, tilt: -0.08 } // the frame's inset panel (stands.js boards)
const TITLE = { w: 2.9, h: 0.6, y: 3.9, z: -0.03 } // the plate above it
const CANVAS_W = 1024
const ROW_MEDALS = ['#ffd23f', '#d5dde8', '#e08a4a']
const LEADERBOARD_REFRESH_S = 60

const images = new Map() // url -> the loaded HTMLImageElement, or null while loading / failed

function pfpImage(url, onLoad) {
  if (!url) return null
  if (images.has(url)) return images.get(url)
  images.set(url, null)
  const img = new Image()
  img.crossOrigin = 'anonymous' // a tainted picture would make the whole texture unusable
  img.onload = () => {
    images.set(url, img)
    onLoad()
  }
  img.onerror = () => {}
  img.src = url
  return null
}

function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

function outlined(ctx, text, x, y, fill, outline = '#16305c', width = 8) {
  ctx.lineJoin = 'round'
  ctx.lineWidth = width
  ctx.strokeStyle = outline
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

function makeBoard(def) {
  const faceCanvas = document.createElement('canvas')
  faceCanvas.width = CANVAS_W
  faceCanvas.height = Math.round((CANVAS_W * FACE.h) / FACE.w)
  const titleCanvas = document.createElement('canvas')
  titleCanvas.width = 640
  titleCanvas.height = Math.round((640 * TITLE.h) / TITLE.w)
  const tex = (c) => {
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  const faceTex = tex(faceCanvas)
  const titleTex = tex(titleCanvas)
  const fmtScore = (v) => formatCash(v) + (def.suffix ?? '')
  const state = { rows: [], me: null, status: 'loading' }

  function paint() {
    const w = faceCanvas.width
    const h = faceCanvas.height
    const ctx = faceCanvas.getContext('2d')
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#8fb0d8'
    ctx.fillRect(0, 0, w, h)
    const rowH = h / 6 // five rows and the footer
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 5; i++) {
      const y = i * rowH + rowH / 2 + 6
      const row = state.rows[i]
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(22,48,92,0.12)'
      ctx.fillRect(14, i * rowH + 8, w - 28, rowH - 6)
      ctx.font = `700 ${rowH * 0.5}px ${FONT}`
      ctx.textAlign = 'left'
      outlined(ctx, `#${i + 1}`, 34, y, ROW_MEDALS[i] ?? '#ffffff')
      if (!row) continue
      // Profile picture, else the initial on a disc.
      const r = rowH * 0.36
      const cx = 34 + rowH * 0.95 + r
      const img = pfpImage(row.pfp, paint)
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, y, r, 0, Math.PI * 2)
      ctx.clip()
      if (img) {
        ctx.drawImage(img, cx - r, y - r, r * 2, r * 2)
      } else {
        ctx.fillStyle = '#36527f'
        ctx.fillRect(cx - r, y - r, r * 2, r * 2)
        ctx.font = `700 ${r * 1.2}px ${FONT}`
        ctx.textAlign = 'center'
        ctx.fillStyle = '#ffffff'
        ctx.fillText((row.name || '?').slice(0, 1).toUpperCase(), cx, y + 2)
      }
      ctx.restore()
      ctx.beginPath()
      ctx.arc(cx, y, r, 0, Math.PI * 2)
      ctx.lineWidth = 4
      ctx.strokeStyle = '#16305c'
      ctx.stroke()
      // Score on the right, name in the room left.
      ctx.font = `700 ${rowH * 0.46}px ${FONT}`
      ctx.textAlign = 'right'
      const score = fmtScore(row.score)
      outlined(ctx, score, w - 34, y, '#ffffff')
      const scoreW = ctx.measureText(score).width
      ctx.textAlign = 'left'
      const nameX = cx + r + 18
      outlined(ctx, fit(ctx, row.name || 'Player', w - 34 - scoreW - 24 - nameX), nameX, y, '#ffffff')
    }
    // Footer: the signed-in player's own place, or why the list is empty.
    ctx.font = `600 ${rowH * 0.34}px ${FONT}`
    ctx.textAlign = 'center'
    const fy = 5 * rowH + rowH / 2 + 8
    let note = ''
    if (state.me) note = `You: #${state.me.rank}  ${fmtScore(state.me.score)}`
    else if (state.status === 'empty') note = 'No scores yet. Be the first!'
    else if (state.status === 'offline') note = 'Leaderboard unavailable'
    else if (state.status === 'loading') note = 'Loading...'
    outlined(ctx, note, w / 2, fy, '#eaf3ff', '#16305c', 6)
    faceTex.needsUpdate = true

    const t = titleCanvas.getContext('2d')
    t.clearRect(0, 0, titleCanvas.width, titleCanvas.height)
    t.fillStyle = '#8fb0d8'
    t.fillRect(0, 0, titleCanvas.width, titleCanvas.height)
    t.font = `700 ${titleCanvas.height * 0.62}px ${FONT}`
    t.textAlign = 'center'
    t.textBaseline = 'middle'
    outlined(t, def.title, titleCanvas.width / 2, titleCanvas.height / 2 + 3, '#ffffff', '#16305c', 12)
    titleTex.needsUpdate = true
  }

  paint()
  fontReady.then(paint)

  return {
    paint,
    face: faceTex,
    title: titleTex,
    async refresh() {
      const res = await bloxity.fetchTop(def.id, 5)
      if (!res) state.status = state.rows.length ? state.status : 'offline'
      else {
        state.rows = res.rows
        state.me = res.me
        state.status = res.rows.length ? 'ok' : 'empty'
      }
      paint()
    },
  }
}

export function buildLeaderboards(scene, panels) {
  const boards = []
  panels.forEach(({ x, z }, i) => {
    const def = LEADERBOARD_BOARDS[i]
    if (!def) return
    const board = makeBoard(def)
    const root = new Group()
    root.position.set(x, 0, z)
    root.rotation.y = -Math.PI / 2
    const make = (tex, w, h, y, zz, tilt) => {
      const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: tex, side: DoubleSide, toneMapped: false }))
      m.position.set(0, y, zz)
      m.rotation.x = tilt
      return m
    }
    root.add(make(board.face, FACE.w, FACE.h, FACE.y, FACE.z, FACE.tilt), make(board.title, TITLE.w, TITLE.h, TITLE.y, TITLE.z, FACE.tilt))
    scene.add(root)
    boards.push(board)
  })

  let last = -Infinity
  let started = false
  // Wait for the sign-in state so the first request already knows the player (the "You" line).
  bloxity.authSettled().then(() => {
    started = true
  })
  return {
    update(elapsed) {
      if (!started || elapsed - last < LEADERBOARD_REFRESH_S) return
      last = elapsed
      for (const b of boards) b.refresh()
    },
  }
}
