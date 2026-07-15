import React, { useCallback, useRef } from 'react'
import { Box } from '@yamada-ui/react'
import type { Marker } from '../types/timeline'
import { tickToPx, pxToTick } from '../utils/tickPixel'
import { TimelineMarker } from './TimelineMarker'

interface Props {
  markers: Marker[]
  lengthTicks: number
  pxPerTick: number
  selectedIds: Set<string>
  onSelect: (id: string | null) => void
  onMoveMarker: (id: string, newTick: number) => void
  onAddMarker: (tick: number) => void
}

const TRACK_HEIGHT = 64

export const TimelineTrack: React.FC<Props> = ({
  markers, lengthTicks, pxPerTick, selectedIds, onSelect, onMoveMarker, onAddMarker,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    id: string
    startTick: number
    startClientX: number
  } | null>(null)

  const totalPx = tickToPx(lengthTicks, pxPerTick)

  const handleMarkerPointerDown = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      e.stopPropagation()
      const m = markers.find(x => x.id === id)
      if (!m) return
      onSelect(id)
      dragStateRef.current = { id, startTick: m.tick, startClientX: e.clientX }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [markers, onSelect],
  )

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragStateRef.current
    if (!d) return
    const deltaPx = e.clientX - d.startClientX
    const deltaTick = pxToTick(Math.abs(deltaPx), pxPerTick) * (deltaPx < 0 ? -1 : 1)
    const newTick = Math.max(0, d.startTick + deltaTick)
    onMoveMarker(d.id, newTick)
  }, [pxPerTick, onMoveMarker])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStateRef.current) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      dragStateRef.current = null
    }
  }, [])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    // マーカー内をクリックした場合は onPointerDown 側で stopPropagation されているので、
    // ここに来るのは空白部分のクリックのみ
    if (e.detail === 2) return // ダブルクリックは別ハンドラ
    onSelect(null)
  }, [onSelect])

  const handleTrackDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    onAddMarker(pxToTick(x, pxPerTick))
  }, [pxPerTick, onAddMarker])

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
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {markers.map(m => (
        <TimelineMarker
          key={m.id}
          marker={m}
          pxPerTick={pxPerTick}
          selected={selectedIds.has(m.id)}
          onPointerDown={handleMarkerPointerDown(m.id)}
        />
      ))}
    </Box>
  )
}
