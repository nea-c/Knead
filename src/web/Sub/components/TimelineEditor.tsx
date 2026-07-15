import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Box } from '@yamada-ui/react'
import { useTimeline } from '../hooks/useTimeline'
import { DEFAULT_PX_PER_TICK } from '../utils/tickPixel'
import { TimelineToolbar } from './TimelineToolbar'
import { TimelineRuler } from './TimelineRuler'
import { TimelineTrack } from './TimelineTrack'

interface Props {
  defaultSoundId?: string
}

export const TimelineEditor: React.FC<Props> = ({ defaultSoundId }) => {
  const timeline = useTimeline()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const pxPerTick = DEFAULT_PX_PER_TICK

  const handleAddAtTick = useCallback((tick: number) => {
    const id = timeline.addMarker({ tick, soundId: defaultSoundId ?? '' })
    setSelectedIds(new Set([id]))
  }, [timeline, defaultSoundId])

  const handleAddAtStart = useCallback(() => {
    handleAddAtTick(0)
  }, [handleAddAtTick])

  const handleSelect = useCallback((id: string | null) => {
    setSelectedIds(id === null ? new Set() : new Set([id]))
  }, [])

  const handleDeleteSelected = useCallback(() => {
    for (const id of selectedIds) timeline.removeMarker(id)
    setSelectedIds(new Set())
  }, [selectedIds, timeline])

  // キーボードショートカット
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault()
          handleDeleteSelected()
        }
      }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        setSelectedIds(new Set(timeline.state.markers.map(m => m.id)))
      }
      else if (e.key === 'Escape') {
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, timeline.state.markers, handleDeleteSelected])

  const sortedMarkers = useMemo(
    () => [...timeline.state.markers].sort((a, b) => a.tick - b.tick),
    [timeline.state.markers],
  )

  return (
    <Box display="flex" flexDir="column" h="100vh" bg="gray.950">
      <TimelineToolbar
        onAddMarker={handleAddAtStart}
        onDeleteSelected={handleDeleteSelected}
        canDelete={selectedIds.size > 0}
      />
      <Box flex="1" overflow="auto">
        <TimelineRuler
          lengthTicks={timeline.state.lengthTicks}
          pxPerTick={pxPerTick}
        />
        <TimelineTrack
          markers={sortedMarkers}
          lengthTicks={timeline.state.lengthTicks}
          pxPerTick={pxPerTick}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onMoveMarker={timeline.moveMarker}
          onAddMarker={handleAddAtTick}
        />
      </Box>
    </Box>
  )
}
