import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box } from '@yamada-ui/react'
import { TIMELINE_MARKER_SIZE, type Marker } from '../types/timeline'
import { tickToPx, pxToTick } from '../utils/tickPixel'
import { TimelineMarker, type ResizeEdge } from './TimelineMarker'

export interface SelectModifiers {
  ctrl: boolean
  shift: boolean
}

interface Props {
  markers: Marker[]
  trackHeight: number
  validSoundIds: Set<string>
  lengthTicks: number
  pxPerTick: number
  selectedIds: Set<string>
  onMarkerClick: (id: string, mods: SelectModifiers) => void
  onClearSelection: () => void
  onRectangleSelect: (ids: string[], mods: SelectModifiers) => void
  onBeginMove: () => void
  onMoveMarkers: (positions: Map<string, { tick: number, trackY?: number }>) => void
  onResizeMarker: (id: string, tick: number, duration: number) => void
  onEndMove: () => void
  onAddMarker: (tick: number) => void
}

interface MarkerOrigin {
  tick: number
  displayY: number
  trackY?: number
}

interface DragState {
  mode: 'move' | 'resize'
  primaryId: string
  origins: Map<string, MarkerOrigin>
  startClientX: number
  startClientY: number
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

const clampTrackY = (y: number, trackHeight: number): number => Math.max(
  TIMELINE_MARKER_SIZE / 2,
  Math.min(trackHeight - TIMELINE_MARKER_SIZE / 2, y),
)

export const TimelineTrack: React.FC<Props> = ({
  markers, trackHeight, validSoundIds, lengthTicks, pxPerTick, selectedIds,
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

  const markerYById = useMemo(() => {
    const result = new Map<string, number>()
    const groups = new Map<number, Marker[]>()
    for (const marker of markers) {
      const group = groups.get(marker.tick)
      if (group) group.push(marker)
      else groups.set(marker.tick, [marker])
    }

    const centerY = trackHeight / 2
    const candidates = Array.from(
      { length: trackHeight - TIMELINE_MARKER_SIZE + 1 },
      (_, index) => TIMELINE_MARKER_SIZE / 2 + index,
    ).sort((a, b) => Math.abs(a - centerY) - Math.abs(b - centerY) || a - b)

    for (const group of groups.values()) {
      const assigned: number[] = []
      for (const marker of group) {
        if (marker.trackY !== undefined) continue
        const y = candidates.find(candidate => (
          assigned.every(existing => Math.abs(existing - candidate) >= TIMELINE_MARKER_SIZE)
        )) ?? centerY
        result.set(marker.id, y)
        assigned.push(y)
      }
      for (const marker of group) {
        if (marker.trackY === undefined) continue
        result.set(marker.id, clampTrackY(marker.trackY, trackHeight))
      }
    }
    return result
  }, [markers, trackHeight])
  const markerYByIdRef = useRef(markerYById)
  markerYByIdRef.current = markerYById

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
          startClientY: e.clientY,
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
      const origins = new Map<string, MarkerOrigin>()
      for (const m of markersRef.current) {
        if (!targetIds.has(m.id)) continue
        origins.set(m.id, {
          tick: m.tick,
          displayY: markerYByIdRef.current.get(m.id) ?? trackHeight / 2,
          trackY: m.trackY,
        })
      }
      dragStateRef.current = {
        mode: 'move',
        primaryId: id,
        origins,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originTick: marker.tick,
        originDuration: marker.duration ?? 0,
        resizeEdge: null,
        wasSelected: isSelected,
        moved: false,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [onMarkerClick, trackHeight],
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
    const deltaY = e.clientY - d.startClientY
    if (!d.moved && Math.hypot(deltaPx, deltaY) > 2) {
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
        const nextDuration = Math.max(0, d.originDuration + deltaTick)
        onResizeMarker(d.primaryId, d.originTick, nextDuration)
      }
      return
    }
    const nextPositions = new Map<string, { tick: number, trackY?: number }>()
    let minOrigin = Infinity
    for (const origin of d.origins.values()) {
      minOrigin = Math.min(minOrigin, origin.tick)
    }
    const clampedDelta = Math.max(
      -minOrigin,
      deltaTick,
    )
    const hasVerticalMove = Math.abs(deltaY) > 2
    if (hasVerticalMove) {
      const originTicks = new Set(Array.from(d.origins.values(), origin => origin.tick))
      for (const marker of markersRef.current) {
        if (d.origins.has(marker.id) || marker.trackY !== undefined || !originTicks.has(marker.tick)) {
          continue
        }
        nextPositions.set(marker.id, {
          tick: marker.tick,
          trackY: markerYByIdRef.current.get(marker.id) ?? trackHeight / 2,
        })
      }
    }
    for (const [id, origin] of d.origins) {
      nextPositions.set(id, {
        tick: origin.tick + clampedDelta,
        trackY: origin.trackY !== undefined || hasVerticalMove
          ? clampTrackY(origin.displayY + deltaY, trackHeight)
          : undefined,
      })
    }
    onMoveMarkers(nextPositions)
  }, [
    rect, pxPerTick, lengthTicks, trackHeight, onMoveMarkers, onResizeMarker, onMarkerClick, onBeginMove,
  ])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (rect) {
      if (!trackRef.current) return
      const r = trackRef.current.getBoundingClientRect()
      const x1 = Math.min(rect.startX, rect.x)
      const x2 = Math.max(rect.startX, rect.x)
      const y1 = Math.min(rect.startY, rect.y)
      const y2 = Math.max(rect.startY, rect.y)
      const startTick = pxToTick(x1, pxPerTick)
      const endTick = pxToTick(x2, pxPerTick)
      const inside = markersRef.current
        .filter((m) => {
          const y = markerYByIdRef.current.get(m.id) ?? trackHeight / 2
          return m.tick >= startTick && m.tick <= endTick && y >= y1 && y <= y2
        })
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
  }, [rect, pxPerTick, trackHeight, onRectangleSelect, onEndMove, onMarkerClick])

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
      h={`${trackHeight}px`}
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
          topPx={markerYById.get(m.id) ?? trackHeight / 2}
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
