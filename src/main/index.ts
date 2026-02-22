import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../renderer/src/types'
import type { FogOp } from '../renderer/src/types'
import * as gs from './gameState'

let dmWindow: BrowserWindow | null = null
let playerWindow: BrowserWindow | null = null

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
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fogofwar')

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
