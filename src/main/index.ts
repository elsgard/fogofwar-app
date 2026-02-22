import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join, extname } from 'path'
import { readFile } from 'fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../renderer/src/types'
import type { FogOp, GameState } from '../renderer/src/types'
import * as gs from './gameState'

let dmWindow: BrowserWindow | null = null
let playerWindow: BrowserWindow | null = null

// ── SSE server (browser player view) ─────────────────────────────────────────
const SSE_PORT = 7654
let sseClients: ServerResponse[] = []

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.woff2': 'font/woff2',
}

function startSseServer(): void {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Allow the Vite dev server origin (and any localhost) to call us
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    const pathname = new URL(req.url ?? '/', `http://localhost:${SSE_PORT}`).pathname

    // Current game state snapshot
    if (pathname === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(gs.getState()))
      return
    }

    // SSE stream — pushes state on every change
    if (pathname === '/events') {
      // Disable Nagle's algorithm so every write() is sent immediately.
      // Without this, the trailing \n\n that terminates an SSE event can sit in
      // the socket buffer until the next write, making the browser always one
      // update behind.
      req.socket?.setNoDelay(true)
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      res.write(':\n\n') // initial keep-alive comment
      sseClients.push(res)
      req.on('close', () => { sseClients = sseClients.filter((c) => c !== res) })
      return
    }

    // In production: serve the bundled renderer as a static SPA
    if (!is.dev) {
      const rendererDir = join(__dirname, '../renderer')
      const filePath = join(rendererDir, pathname === '/' ? 'index.html' : pathname)
      if (!filePath.startsWith(rendererDir)) { res.writeHead(403); res.end(); return }
      try {
        const data = await readFile(filePath)
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
        res.end(data)
      } catch {
        // Unknown path → serve index.html so the SPA can handle routing
        try {
          const html = await readFile(join(rendererDir, 'index.html'))
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(html)
        } catch { res.writeHead(404); res.end() }
      }
      return
    }

    res.writeHead(404); res.end()
  })

  server.listen(SSE_PORT, '127.0.0.1', () => {
    console.log(`SSE server listening on http://127.0.0.1:${SSE_PORT}`)
  })
  server.on('error', (err) => {
    console.error('SSE server error:', err)
  })
}

function broadcastSse(state: GameState): void {
  const payload = `data: ${JSON.stringify(state)}\n\n`
  sseClients = sseClients.filter((c) => !c.destroyed)
  for (const client of sseClients) client.write(payload)
}

function rendererUrl(role: 'dm' | 'player'): string {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}?role=${role}`
  }
  return `file://${join(__dirname, '../renderer/index.html')}?role=${role}`
}

function createDMWindow(): void {
  dmWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    title: 'Fog of War — DM',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  dmWindow.on('ready-to-show', () => dmWindow!.show())

  dmWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  dmWindow.loadURL(rendererUrl('dm'))
}

function createPlayerWindow(): void {
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.focus()
    return
  }

  playerWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: 'Fog of War — Players',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  playerWindow.on('ready-to-show', () => {
    playerWindow!.show()
    // Send the current state as soon as the player window is ready
    playerWindow!.webContents.send(IPC.STATE_UPDATE, gs.getState())
  })

  playerWindow.on('closed', () => {
    playerWindow = null
  })

  playerWindow.loadURL(rendererUrl('player'))
}

function broadcastState(): void {
  const state = gs.getState()
  dmWindow?.webContents.send(IPC.STATE_UPDATE, state)
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.webContents.send(IPC.STATE_UPDATE, state)
  }
  broadcastSse(state)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fogofwar')
  startSseServer()

  // Register a protocol to safely serve local image files chosen by the DM
  protocol.handle('fogmap', (request) => {
    const filePath = decodeURIComponent(request.url.slice('fogmap://'.length))
    return net.fetch(`file:///${filePath}`)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ── IPC handlers ──────────────────────────────────────────────────────────

  // Returns the full current game state (renderer calls this on mount)
  ipcMain.handle(IPC.GET_STATE, () => gs.getState())

  // Opens a native file dialog and returns the selected image as a data URL
  ipcMain.handle(IPC.LOAD_MAP, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Map Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return null

    const filePath = filePaths[0]
    const buffer = await readFile(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : 'image/png'
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`

    // Measure natural dimensions by sending the dataUrl to the renderer
    // (dimensions come back from the renderer via a second message)
    return { dataUrl, name: filePath.split('/').pop() ?? filePath, ext }
  })

  // Renderer sends map info including dimensions once the image is loaded
  ipcMain.on(IPC.LOAD_MAP + ':commit', (_, mapInfo) => {
    gs.setMap(mapInfo)
    broadcastState()
  })

  ipcMain.on(IPC.ADD_FOG_OP, (_, op) => {
    gs.addFogOp(op)
    broadcastState()
  })

  ipcMain.on(IPC.BATCH_FOG_OPS, (_, ops: FogOp[]) => {
    gs.addFogOps(ops)
    broadcastState()
  })

  ipcMain.on(IPC.RESET_FOG, () => {
    gs.resetFog()
    broadcastState()
  })

  ipcMain.on(IPC.ADD_TOKEN, (_, token) => {
    gs.addToken(token)
    broadcastState()
  })

  ipcMain.on(IPC.UPDATE_TOKEN, (_, token) => {
    gs.updateToken(token)
    broadcastState()
  })

  ipcMain.on(IPC.REMOVE_TOKEN, (_, id) => {
    gs.removeToken(id)
    broadcastState()
  })

  ipcMain.on(IPC.OPEN_PLAYER_WINDOW, () => {
    createPlayerWindow()
  })

  createDMWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createDMWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
