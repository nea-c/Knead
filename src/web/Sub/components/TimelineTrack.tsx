import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box } from '@yamada-ui/react'
import type { Marker } from '../types/timeline'
import { tickToPx, pxToTick } from '../utils/tickPixel'
import { TimelineMarker, type ResizeEdge } from './TimelineMarker'

export interface SelectModifiers {
  ctrl: boolean
  shift: boolean
}

interface Props {
  markers: Marker[]
  validSoundIds: Set<string>
  lengthTicks: number
  pxPerTick: number
  selectedIds: Set<string>
  onMarkerClick: (id: string, mods: SelectModifiers) => void
  onClearSelection: () => void
  onRectangleSelect: (ids: string[], mods: SelectModifiers) => void
  onBeginMove: () => void
  onMoveMarkers: (deltas: Map<string, number>) => void
  onResizeMarker: (id: string, tick: number, duration: number) => void
  onEndMove: () => void
  onAddMarker: (tick: number) => void
}

const TRACK_HEIGHT = 64

interface DragState {
  mode: 'move' | 'resize'
  primaryId: string
  origins: Map<string, number>
  startClientX: number
  originTick: number
  originDuration: number
  resizeEdge: ResizeEdge | null
  wasSelected: boolean
  moved: boolean
}

interface RectState {
  startX: number
  startY: number
  x: number
  y: number
  additive: boolean
}

export const TimelineTrack: React.FC<Props> = ({
  markers, validSoundIds, lengthTicks, pxPerTick, selectedIds,
  onMarkerClick, onClearSelection, onRectangleSelect,
  onBeginMove, onMoveMarkers, onResizeMarker, onEndMove, onAddMarker,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const [rect, setRect] = useState<RectState | null>(null)
  const [ctrlPressed, setCtrlPressed] = useState(false)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  const markersRef = useRef(markers)
  markersRef.current = markers

  const totalPx = tickToPx(lengthTicks, pxPerTick)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPressed(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPressed(false)
    }
    const handleBlur = () => setCtrlPressed(false)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  const handleMarkerPointerDown = useCallback(
    (id: string) => (resizeEdge: ResizeEdge | null, e: React.PointerEvent) => {
      e.stopPropagation()
      const mods = { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }
      if (mods.shift || e.metaKey) {
        onMarkerClick(id, mods)
        return
      }

      const marker = markersRef.current.find(m => m.id === id)
      if (!marker) return
      const isSelected = selectedIdsRef.current.has(id)

      if (e.ctrlKey && resizeEdge !== null) {
        dragStateRef.current = {
          mode: 'resize',
          primaryId: id,
          origins: new Map(),
          startClientX: e.clientX,
          originTick: marker.tick,
          originDuration: marker.duration ?? 0,
          resizeEdge,
          wasSelected: isSelected,
          moved: false,
        }
        setResizingId(id)
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        return
      }
      if (e.ctrlKey) {
        onMarkerClick(id, mods)
        return
      }

      // 未選択マーカーを掴んだ場合はここで単独選択に切り替える
      if (!isSelected) onMarkerClick(id, { ctrl: false, shift: false })
      const targetIds = isSelected ? selectedIdsRef.current : new Set([id])
      const origins = new Map<string, number>()
      for (const m of markersRef.current) {
        if (targetIds.has(m.id)) origins.set(m.id, m.tick)
      }
      dragStateRef.current = {
        mode: 'move',
        primaryId: id,
        origins,
        startClientX: e.clientX,
        originTick: marker.tick,
        originDuration: marker.duration ?? 0,
        resizeEdge: null,
        wasSelected: isSelected,
        moved: false,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [onMarkerClick],
  )

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // 矩形選択中
    if (rect) {
      if (!trackRef.current) return
      const r = trackRef.current.getBoundingClientRect()
      setRect({ ...rect, x: e.clientX - r.left, y: e.clientY - r.top })
      return
    }
    const d = dragStateRef.current
    if (!d) return
    const deltaPx = e.clientX - d.startClientX
    if (!d.moved && Math.abs(deltaPx) > 2) {
      d.moved = true
      if (d.mode === 'resize' && !d.wasSelected) {
        onMarkerClick(d.primaryId, { ctrl: false, shift: false })
      }
      onBeginMove()
    }
    if (!d.moved) return
    const deltaTick = pxToTick(Math.abs(deltaPx), pxPerTick) * (deltaPx < 0 ? -1 : 1)
    if (d.mode === 'resize') {
      const originEnd = d.originTick + d.originDuration
      if (d.resizeEdge === 'start') {
        const nextTick = Math.max(0, Math.min(originEnd, d.originTick + deltaTick))
        onResizeMarker(d.primaryId, nextTick, originEnd - nextTick)
      }
      else {
        const maxDuration = Math.max(0, lengthTicks - d.originTick)
        const nextDuration = Math.max(0, Math.min(maxDuration, d.originDuration + deltaTick))
        onResizeMarker(d.primaryId, d.originTick, nextDuration)
      }
      return
    }
    const nextTicks = new Map<string, number>()
    // 選択マーカー群のうち最小 tick を負にしないためのクランプ
    let minOrigin = Infinity
    for (const t of d.origins.values()) if (t < minOrigin) minOrigin = t
    const clampedDelta = Math.max(-minOrigin, deltaTick)
    for (const [id, origin] of d.origins) {
      nextTicks.set(id, origin + clampedDelta)
    }
    onMoveMarkers(nextTicks)
  }, [
    rect, pxPerTick, lengthTicks, onMoveMarkers, onResizeMarker, onMarkerClick, onBeginMove,
  ])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (rect) {
      if (!trackRef.current) return
      const r = trackRef.current.getBoundingClientRect()
      const x1 = Math.min(rect.startX, rect.x)
      const x2 = Math.max(rect.startX, rect.x)
      const startTick = pxToTick(x1, pxPerTick)
      const endTick = pxToTick(x2, pxPerTick)
      const inside = markersRef.current
        .filter(m => m.tick >= startTick && m.tick <= endTick)
        .map(m => m.id)
      onRectangleSelect(inside, { ctrl: rect.additive, shift: false })
      setRect(null)
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) }
      catch { /* noop */ }
      return
    }
    const d = dragStateRef.current
    if (d) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) }
      catch { /* noop */ }
      if (d.moved) onEndMove()
      else if (d.mode === 'resize' && e.type === 'pointerup') {
        onMarkerClick(d.primaryId, { ctrl: true, shift: false })
      }
      dragStateRef.current = null
      setResizingId(null)
    }
  }, [rect, pxPerTick, onRectangleSelect, onEndMove, onMarkerClick])

  const handleTrackPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return
    // Shift 押下 → 矩形選択開始（既存選択に追加する場合は Ctrl 併用）
    if (e.shiftKey) {
      const r = trackRef.current!.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      setRect({ startX: x, startY: y, x, y, additive: e.ctrlKey || e.metaKey })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
  }, [])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.detail === 2) return
    if (e.shiftKey || e.ctrlKey || e.metaKey) return
    onClearSelection()
  }, [onClearSelection])

  const handleTrackDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current) return
    if (e.target !== e.currentTarget) return
    const r = trackRef.current.getBoundingClientRect()
    const x = e.clientX - r.left
    onAddMarker(pxToTick(x, pxPerTick))
  }, [pxPerTick, onAddMarker])

  const rectStyle = useMemo(() => {
    if (!rect) return null
    const x = Math.min(rect.startX, rect.x)
    const y = Math.min(rect.startY, rect.y)
    const w = Math.abs(rect.x - rect.startX)
    const h = Math.abs(rect.y - rect.startY)
    return { x, y, w, h }
  }, [rect])

  return (
    <Box
      ref={trackRef}
      position="relative"
      w={`${totalPx}px`}
      h={`${TRACK_HEIGHT}px`}
      bg="gray.800"
      borderBottom="1px solid"
      borderColor="gray.700"
      onClick={handleTrackClick}
      onDoubleClick={handleTrackDoubleClick}
      onPointerDown={handleTrackPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {markers.map(m => (
        <TimelineMarker
          key={m.id}
          marker={m}
          invalidSound={m.soundId === '' || !validSoundIds.has(m.soundId)}
          pxPerTick={pxPerTick}
          selected={selectedIds.has(m.id)}
          resizeCursor={ctrlPressed || resizingId === m.id}
          onPointerDown={handleMarkerPointerDown(m.id)}
        />
      ))}
      {rectStyle && (
        <Box
          position="absolute"
          left={`${rectStyle.x}px`}
          top={`${rectStyle.y}px`}
          w={`${rectStyle.w}px`}
          h={`${rectStyle.h}px`}
          border="1px solid"
          borderColor="blue.300"
          bg="blue.500"
          opacity={0.15}
          pointerEvents="none"
        />
      )}
    </Box>
  )
}
