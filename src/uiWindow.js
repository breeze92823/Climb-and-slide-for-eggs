// Shared popup window shell (styles in uiWindow.css), taken from the reference's Index
// window: blurred backdrop, orange studded title bar with a red X, dark glass body.
// The caller fills `body`, and may add pieces around the frame to `stack`. Only one window
// is open at a time; Esc closes it (main.js routes Esc through closeTopWindow before the
// portal menu).
import './uiWindow.css'

let current = null // the open window, if any

// Closes the open window. Returns true if there was one (so Esc can stop there).
export function closeTopWindow() {
  if (!current) return false
  current.close()
  return true
}

// Boxity's toolbar (the 'toolbar' reserved area from bloxity.onReservedAreas) sits over the
// top-left corner, over the whole top edge on narrow phones. A window that would reach under
// it is fitted into the screen below it instead (--uiw-top, uiWindow.css). The chat feed under
// the toolbar is left out: clearing it too would leave a landscape phone almost no height.
const TOOLBAR_GAP = 8 // px kept clear under the toolbar
let toolbar = null
export function setWindowReserved(areas) {
  toolbar = areas.find((a) => a.id === 'toolbar') ?? null
  if (current) fitClear(current)
}
window.addEventListener('resize', () => current && fitClear(current))

function fitClear({ overlay, stack }) {
  overlay.style.removeProperty('--uiw-top')
  if (!toolbar || !toolbar.width || !toolbar.height) return
  const bottom = toolbar.top + toolbar.height
  for (const e of [stack, ...stack.children]) {
    const r = e.getBoundingClientRect()
    if (r.left < toolbar.left + toolbar.width && toolbar.left < r.right && r.top < bottom + TOOLBAR_GAP) {
      overlay.style.setProperty('--uiw-top', `${bottom + TOOLBAR_GAP}px`)
      return
    }
  }
}

// options: { title, className (added to the overlay; set --uiw-w / --uiw-h there for another
// size), onOpen, onClose }. Returns { overlay, stack, dialog, head, body, open, close, toggle, isOpen }.
export function createWindow({ title, className = '', onOpen, onClose } = {}) {
  const overlay = document.createElement('div')
  overlay.className = `uiw-overlay ${className}`.trim()
  overlay.hidden = true

  const stack = document.createElement('div')
  stack.className = 'uiw-stack'

  const dialog = document.createElement('div')
  dialog.className = 'uiw-dialog'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', title)

  const head = document.createElement('div')
  head.className = 'uiw-head'
  head.innerHTML = '<h2 class="uiw-text"></h2>'
  head.querySelector('h2').textContent = title

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'uiw-close uiw-text'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.textContent = 'X'
  head.append(closeBtn)

  const body = document.createElement('div')
  body.className = 'uiw-body'

  dialog.append(head, body)
  stack.append(dialog)
  overlay.append(stack)
  document.body.append(overlay)

  let shown = false
  const win = {
    overlay,
    stack,
    dialog,
    head,
    body,
    isOpen: () => shown,
    open() {
      if (shown) return
      if (current) current.close()
      current = win
      shown = true
      onOpen?.()
      overlay.hidden = false
      fitClear(win)
      stack.classList.remove('pop')
      void stack.offsetWidth // restarts the animation
      stack.classList.add('pop')
      document.exitPointerLock?.() // the cursor has to be free to press the buttons
    },
    close() {
      if (!shown) return
      shown = false
      overlay.hidden = true
      current = null
      onClose?.()
    },
    toggle: () => (win.isOpen() ? win.close() : win.open()),
  }

  closeBtn.addEventListener('click', win.close)
  // A tap on the world around the window closes it.
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) win.close()
  })
  return win
}
