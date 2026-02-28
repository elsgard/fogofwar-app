import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { MapLayer } from '../pixi/MapLayer'
import { FogLayer } from '../pixi/FogLayer'
import { TokenLayer } from '../pixi/TokenLayer'
import { LaserLayer } from '../pixi/LaserLayer'
import { useGameStore } from '../store/gameStore'
import type { FogOp, PlayerViewport } from '../types'

interface Props {
  isPlayerView?: boolean
}

export interface MapCanvasHandle {
  getCurrentViewport: () => PlayerViewport | null
}

export const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(
  { isPlayerView = false }: Props,
  ref
): React.JSX.Element {
  const canvasRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)

  // Scene layers
  const worldRef = useRef<Container | null>(null)
  const mapLayerRef = useRef<MapLayer | null>(null)
  const fogLayerRef = useRef<FogLayer | null>(null)
  const tokenLayerRef = useRef<TokenLayer | null>(null)
  const laserLayerRef = useRef<LaserLayer | null>(null)

  // Brush cursor — lives on app.stage (screen space, unaffected by pan/zoom)
  const brushCursorRef = useRef<Graphics | null>(null)

  // Throttle laser IPC sends to ~60fps
  const lastLaserSendRef = useRef(0)

  // Interaction state (refs — no re-renders needed)
  const isPaintingRef = useRef(false)
  const isDraggingTokenRef = useRef<string | null>(null)
  const isPanningRef = useRef(false)
  const lastPanRef = useRef<{ x: number; y: number } | null>(null)
  // Last painted map-space position, for stroke interpolation
  const lastPaintPosRef = useRef<{ x: number; y: number } | null>(null)
  // All ops accumulated during a single stroke — flushed to IPC on pointerup
  const strokeBufferRef = useRef<FogOp[]>([])

  // Track previous fogOps length to decide incremental vs full replay
  const prevFogOpsLenRef = useRef(0)

  const map = useGameStore((s) => s.map)
  const fogOps = useGameStore((s) => s.fogOps)
  const tokens = useGameStore((s) => s.tokens)
  const activeTool = useGameStore((s) => s.activeTool)
  const brushRadius = useGameStore((s) => s.brushRadius)
  const tokenRadius = useGameStore((s) => s.tokenRadius)
  const tokenLabelSize = useGameStore((s) => s.tokenLabelSize)
  const tokenLabelVisible = useGameStore((s) => s.tokenLabelVisible)
  const selectedTokenId = useGameStore((s) => s.selectedTokenId)
  const laserRadius = useGameStore((s) => s.laserRadius)
  const laserColor = useGameStore((s) => s.laserColor)
  const { commitStroke, updateToken, setSelectedTokenId } = useGameStore()

  // ── PixiJS init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return

    // Guard against React StrictMode calling cleanup before async init finishes.
    // If cancelled=true when .then() runs we destroy immediately and bail out.
    let cancelled = false
    let initDone = false

    const app = new Application()

    app
      .init({
        resizeTo: canvasRef.current,
        background: '#1a1a2e',
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      .then(async () => {
        initDone = true
        if (cancelled || !canvasRef.current) {
          app.destroy(true)
          return
        }

        appRef.current = app
        canvasRef.current.appendChild(app.canvas)

        const world = new Container()
        app.stage.addChild(world)
        worldRef.current = world

        const mapLayer = new MapLayer()
        const fogLayer = new FogLayer()
        const tokenLayer = new TokenLayer()
        tokenLayer.setPlayerView(isPlayerView)
        const { tokenRadius: initRadius, tokenLabelSize: initLabelSize, tokenLabelVisible: initLabelVisible } =
          useGameStore.getState()
        tokenLayer.setRadius(initRadius)
        tokenLayer.setLabelSize(initLabelSize)
        tokenLayer.setLabelsVisible(initLabelVisible)

        const laserLayer = new LaserLayer()

        // DM: tokens above fog (always visible)
        // Player: tokens below fog (hidden by unrevealed areas)
        // Laser is always on top of everything in both views
        if (isPlayerView) {
          world.addChild(mapLayer, tokenLayer, fogLayer, laserLayer)
        } else {
          world.addChild(mapLayer, fogLayer, tokenLayer, laserLayer)
        }
        mapLayerRef.current = mapLayer
        fogLayerRef.current = fogLayer
        tokenLayerRef.current = tokenLayer
        laserLayerRef.current = laserLayer

        app.ticker.add(() => laserLayer.tick())

        // Brush cursor lives in stage space (not affected by world pan/zoom)
        const brushCursor = new Graphics()
        brushCursor.eventMode = 'none'
        app.stage.addChild(brushCursor)
        brushCursorRef.current = brushCursor

        // Re-fit the world whenever the canvas is resized
        app.renderer.on('resize', fitWorld)

        // MapCanvas only mounts after `map` is set in state (it replaces the
        // empty-state div). That means the map useEffect already ran while
        // mapLayerRef was null and returned early. Read current state now and
        // initialise everything that was missed.
        const { map: currentMap, fogOps: currentFogOps, tokens: currentTokens } =
          useGameStore.getState()
        if (currentMap) {
          // Initialise fog BEFORE awaiting the map image so that fogLayer.isReady
          // becomes true as soon as possible. Fog ops arriving via SSE while the
          // image is decoding can then be rendered incrementally by the fogOps
          // useEffect instead of being silently dropped (isReady=false → early return).
          fogLayer.init(
            app.renderer as Parameters<FogLayer['init']>[0],
            currentMap.width,
            currentMap.height,
          )
          fogLayer.setAlpha(isPlayerView ? 1 : 0.5)
          fogLayer.applyOps(currentFogOps)
          prevFogOpsLenRef.current = currentFogOps.length
          tokenLayer.syncTokens(currentTokens)

          // Fit the world using known dimensions before the image loads so the
          // fog is already positioned correctly while the sprite is pending.
          const sidebarW = isPlayerView ? 0 : 300
          const availW = app.screen.width - sidebarW
          const availH = app.screen.height
          const scale = Math.min(availW / currentMap.width, availH / currentMap.height, 1)
          world.scale.set(scale)
          world.x = sidebarW + (availW - currentMap.width * scale) / 2
          world.y = (availH - currentMap.height * scale) / 2

          // Now load the map image (may take hundreds of ms for large images).
          await mapLayer.setMap(currentMap.dataUrl, currentMap.width, currentMap.height)
          if (cancelled) return
          // Re-fit now that mapLayer.mapWidth is set (needed for future fitWorld() calls).
          fitWorld()
        }
      })

    return () => {
      cancelled = true
      if (initDone) {
        // init already resolved — safe to destroy now
        app.destroy(true)
      }
      // if init is still pending, the .then() branch above will destroy instead
      appRef.current = null
      worldRef.current = null
      mapLayerRef.current = null
      fogLayerRef.current = null
      tokenLayerRef.current = null
      laserLayerRef.current = null
      brushCursorRef.current = null
    }
  }, [isPlayerView])

  // ── React to map changes ─────────────────────────────────────────────────
  useEffect(() => {
    const mapLayer = mapLayerRef.current
    const fogLayer = fogLayerRef.current
    const app = appRef.current
    if (!mapLayer || !fogLayer || !app) return

    if (!map) {
      mapLayer.clearMap()
      fogLayer.cleanup()
      prevFogOpsLenRef.current = 0
      return
    }

    let cancelled = false
    const run = async (): Promise<void> => {
      // Init fog BEFORE awaiting the map image (same reasoning as PixiJS init
      // block): we know the dimensions already, so make fogLayer.isReady=true
      // immediately so SSE fog ops arriving during image loading are rendered
      // incrementally instead of being dropped.
      fogLayer.init(app.renderer as Parameters<FogLayer['init']>[0], map.width, map.height)
      fogLayer.setAlpha(isPlayerView ? 1 : 0.5)
      // Read fogOps from store rather than the closure value, in case SSE updates
      // arrived between when this effect registered and when it runs.
      const currentFogOps = useGameStore.getState().fogOps
      fogLayer.applyOps(currentFogOps)
      prevFogOpsLenRef.current = currentFogOps.length

      await mapLayer.setMap(map.dataUrl, map.width, map.height)
      if (cancelled) return
      fitWorld()
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // ── React to fog changes (incremental where possible) ────────────────────
  useEffect(() => {
    const fogLayer = fogLayerRef.current
    if (!fogLayer?.isReady) return

    const newLen = fogOps.length
    const prevLen = prevFogOpsLenRef.current

    if (newLen === prevLen) {
      // IPC echo with identical content — no-op
    } else if (newLen === 0 || newLen < prevLen) {
      // Reset or ops were removed — full replay from scratch
      fogLayer.applyOps(fogOps)
    } else {
      // New ops appended (1 or many — handles React-batched addFogOp calls).
      // Apply only the new ops incrementally; avoids a full replay that would
      // wipe intermediate interpolated circles the DM already rendered locally.
      for (let i = prevLen; i < newLen; i++) {
        fogLayer.applyOneOp(fogOps[i])
      }
    }

    prevFogOpsLenRef.current = newLen
  }, [fogOps])

  // ── React to token changes ───────────────────────────────────────────────
  useEffect(() => {
    tokenLayerRef.current?.syncTokens(tokens)
  }, [tokens])

  // ── Highlight selected token (DM only) ───────────────────────────────────
  useEffect(() => {
    if (!isPlayerView) tokenLayerRef.current?.setSelectedToken(selectedTokenId)
  }, [selectedTokenId, isPlayerView])

  // ── Receive laser pointer (Electron player window via IPC) ────────────────
  useEffect(() => {
    if (!window.api) return
    return window.api.onLaserPointer((pos) => {
      if (pos) laserLayerRef.current?.setPosition(pos.x, pos.y, pos.radius, pos.color)
      else laserLayerRef.current?.clearPointer()
    })
  }, [])

  // ── Receive laser pointer (browser player via custom DOM event) ───────────
  useEffect(() => {
    if (window.api) return // handled by IPC above
    const handler = (e: Event): void => {
      const pos = (e as CustomEvent<{ x: number; y: number; radius: number; color: string } | null>).detail
      if (pos) laserLayerRef.current?.setPosition(pos.x, pos.y, pos.radius, pos.color)
      else laserLayerRef.current?.clearPointer()
    }
    window.addEventListener('laser-pointer', handler)
    return () => window.removeEventListener('laser-pointer', handler)
  }, [])

  // ── Clear laser when DM switches away from laser tool ────────────────────
  useEffect(() => {
    if (!isPlayerView && activeTool !== 'laser') {
      laserLayerRef.current?.clearPointer()
      window.api?.sendLaserPointer(null)
    }
  }, [activeTool, isPlayerView])

  // ── React to token radius changes ────────────────────────────────────────
  useEffect(() => {
    tokenLayerRef.current?.setRadius(tokenRadius)
  }, [tokenRadius])

  // ── React to token label changes ─────────────────────────────────────────
  useEffect(() => {
    tokenLayerRef.current?.setLabelSize(tokenLabelSize)
  }, [tokenLabelSize])

  useEffect(() => {
    tokenLayerRef.current?.setLabelsVisible(tokenLabelVisible)
  }, [tokenLabelVisible])

  // ── Fit world into canvas ────────────────────────────────────────────────
  // In DM view the sidebar overlays the left 260px, so we fit into the
  // remaining area and offset the world accordingly.
  const SIDEBAR_W = isPlayerView ? 0 : 300

  const fitWorld = useCallback(() => {
    const world = worldRef.current
    const app = appRef.current
    const mapLayer = mapLayerRef.current
    if (!world || !app || !mapLayer || mapLayer.mapWidth === 0) return

    const availW = app.screen.width - SIDEBAR_W
    const availH = app.screen.height

    const scaleX = availW / mapLayer.mapWidth
    const scaleY = availH / mapLayer.mapHeight
    const scale = Math.min(scaleX, scaleY, 1)

    world.scale.set(scale)
    world.x = SIDEBAR_W + (availW - mapLayer.mapWidth * scale) / 2
    world.y = (availH - mapLayer.mapHeight * scale) / 2
  }, [SIDEBAR_W])

  // ── Expose getCurrentViewport to parent (DM only) ─────────────────────────
  useImperativeHandle(ref, () => ({
    getCurrentViewport: () => {
      const world = worldRef.current
      const app = appRef.current
      if (!world || !app) return null
      const screenCX = SIDEBAR_W + (app.screen.width - SIDEBAR_W) / 2
      const screenCY = app.screen.height / 2
      return {
        x: (screenCX - world.x) / world.scale.x,
        y: (screenCY - world.y) / world.scale.y,
        scale: world.scale.x,
      }
    },
  }), [SIDEBAR_W])

  // ── Apply pushed player viewport (player view only) ───────────────────────
  const playerViewport = useGameStore((s) => s.playerViewport)
  useEffect(() => {
    if (!isPlayerView) return
    const world = worldRef.current
    const app = appRef.current
    if (!world || !app) return
    if (!playerViewport) {
      fitWorld()
    } else {
      world.scale.set(playerViewport.scale)
      world.x = app.screen.width / 2 - playerViewport.x * playerViewport.scale
      world.y = app.screen.height / 2 - playerViewport.y * playerViewport.scale
    }
  }, [playerViewport, isPlayerView, fitWorld])

  // ── Coordinate helpers ───────────────────────────────────────────────────
  const toMapCoords = useCallback((e: React.PointerEvent): { x: number; y: number } => {
    const world = worldRef.current
    const canvas = canvasRef.current
    if (!world || !canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - world.x) / world.scale.x,
      y: (e.clientY - rect.top - world.y) / world.scale.y,
    }
  }, [])

  const toScreenCoords = useCallback((e: React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  // ── Brush cursor ─────────────────────────────────────────────────────────
  const updateBrushCursor = useCallback(
    (e: React.PointerEvent, tool: string, radius: number) => {
      const cursor = brushCursorRef.current
      const world = worldRef.current
      if (!cursor) return

      cursor.clear()

      if (isPlayerView || (tool !== 'fog-reveal' && tool !== 'fog-hide')) return

      const { x, y } = toScreenCoords(e)
      const screenRadius = radius * (world?.scale.x ?? 1)

      if (tool === 'fog-reveal') {
        // Bright green ring: reveals fog
        cursor
          .circle(x, y, screenRadius)
          .stroke({ color: 0x00ff88, width: 1.5, alpha: 0.85 })
      } else {
        // Red ring: hides (re-fogs)
        cursor
          .circle(x, y, screenRadius)
          .stroke({ color: 0xff4444, width: 1.5, alpha: 0.85 })
        // Small crosshair in center
        cursor
          .moveTo(x - 6, y).lineTo(x + 6, y)
          .moveTo(x, y - 6).lineTo(x, y + 6)
          .stroke({ color: 0xff4444, width: 1, alpha: 0.7 })
      }
    },
    [isPlayerView, toScreenCoords]
  )

  // ── Paint helper (with stroke interpolation) ─────────────────────────────
  const paintAt = useCallback(
    (mapX: number, mapY: number, tool: 'fog-reveal' | 'fog-hide', radius: number) => {
      const fogLayer = fogLayerRef.current
      if (!fogLayer?.isReady) return

      const opType = tool === 'fog-reveal' ? 'reveal-circle' : 'hide-circle'
      const last = lastPaintPosRef.current

      if (last) {
        const dx = mapX - last.x
        const dy = mapY - last.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const step = radius * 0.4
        if (dist > step) {
          const steps = Math.ceil(dist / step)
          for (let i = 1; i < steps; i++) {
            const t = i / steps
            const op: FogOp = { type: opType, x: last.x + dx * t, y: last.y + dy * t, radius }
            fogLayer.applyOneOp(op)
            strokeBufferRef.current.push(op)
          }
        }
      }

      const op: FogOp = { type: opType, x: mapX, y: mapY, radius }
      fogLayer.applyOneOp(op)
      strokeBufferRef.current.push(op)
      lastPaintPosRef.current = { x: mapX, y: mapY }
    },
    [] // no deps — only touches refs
  )

  // ── Pointer event handlers ───────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isPlayerView) return
      const { x, y } = toMapCoords(e)

      if (activeTool === 'pan') {
        isPanningRef.current = true
        lastPanRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      if (activeTool === 'token-move') {
        const hitId = tokenLayerRef.current?.hitTest(x, y) ?? null
        setSelectedTokenId(hitId)
        if (hitId) isDraggingTokenRef.current = hitId
        return
      }

      if (activeTool === 'fog-reveal' || activeTool === 'fog-hide') {
        isPaintingRef.current = true
        lastPaintPosRef.current = null
        strokeBufferRef.current = []
        paintAt(x, y, activeTool, brushRadius)
      }
    },
    [isPlayerView, activeTool, brushRadius, toMapCoords, paintAt, setSelectedTokenId]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPlayerView) return

      updateBrushCursor(e, activeTool, brushRadius)

      if (isPanningRef.current && lastPanRef.current && worldRef.current) {
        const dx = e.clientX - lastPanRef.current.x
        const dy = e.clientY - lastPanRef.current.y
        worldRef.current.x += dx
        worldRef.current.y += dy
        lastPanRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      if (isDraggingTokenRef.current) {
        const { x, y } = toMapCoords(e)
        tokenLayerRef.current?.moveToken(isDraggingTokenRef.current, x, y)
        return
      }

      if (isPaintingRef.current && (activeTool === 'fog-reveal' || activeTool === 'fog-hide')) {
        const { x, y } = toMapCoords(e)
        paintAt(x, y, activeTool, brushRadius)
      }

      if (activeTool === 'laser') {
        const { x, y } = toMapCoords(e)
        laserLayerRef.current?.setPosition(x, y, laserRadius, laserColor)
        const now = Date.now()
        if (now - lastLaserSendRef.current >= 16) {
          lastLaserSendRef.current = now
          window.api?.sendLaserPointer({ x, y, radius: laserRadius, color: laserColor })
        }
        return
      }

      // Show a hovered token's label in DM view even when labels are globally hidden
      if (!tokenLabelVisible) {
        const { x, y } = toMapCoords(e)
        tokenLayerRef.current?.setHoveredToken(tokenLayerRef.current.hitTest(x, y))
      }
    },
    [isPlayerView, activeTool, brushRadius, tokenLabelVisible, laserRadius, laserColor, toMapCoords, paintAt, updateBrushCursor]
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isPlayerView) return

      isPanningRef.current = false
      lastPanRef.current = null
      isPaintingRef.current = false
      lastPaintPosRef.current = null

      // Flush the stroke buffer — one IPC call, player updates now
      if (strokeBufferRef.current.length > 0) {
        commitStroke(strokeBufferRef.current)
        strokeBufferRef.current = []
      }

      if (isDraggingTokenRef.current) {
        const { x, y } = toMapCoords(e)
        const token = useGameStore.getState().tokens.find((t) => t.id === isDraggingTokenRef.current)
        if (token) updateToken({ ...token, x, y })
        isDraggingTokenRef.current = null
      }
    },
    [isPlayerView, toMapCoords, updateToken, commitStroke]
  )

  const onPointerLeave = useCallback(
    (e: React.PointerEvent) => {
      brushCursorRef.current?.clear()
      tokenLayerRef.current?.setHoveredToken(null)
      laserLayerRef.current?.clearPointer()
      window.api?.sendLaserPointer(null)
      onPointerUp(e)
    },
    [onPointerUp]
  )

  // ── Scroll to zoom ───────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    const world = worldRef.current
    const canvas = canvasRef.current
    if (!world || !canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const newScale = Math.min(Math.max(world.scale.x * factor, 0.1), 5)

    world.x = mouseX - (mouseX - world.x) * (newScale / world.scale.x)
    world.y = mouseY - (mouseY - world.y) * (newScale / world.scale.y)
    world.scale.set(newScale)
  }, [])

  return (
    <div
      ref={canvasRef}
      style={{ width: '100%', height: '100%', cursor: getCursor(activeTool, isPlayerView) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
    />
  )
})

function getCursor(tool: string, isPlayerView: boolean): string {
  if (isPlayerView) return 'default'
  switch (tool) {
    case 'fog-reveal':
    case 'fog-hide':
      return 'none' // hide the system cursor — we draw our own ring
    case 'pan':
      return 'grab'
    case 'token-move':
      return 'pointer'
    default:
      return 'default'
  }
}
