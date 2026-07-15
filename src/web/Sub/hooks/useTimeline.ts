import { useCallback, useState } from 'react'
import { produce } from 'immer'
import { v4 as uuidv4 } from 'uuid'
import type { Marker, Tick, TimelineState } from '../types/timeline'
import { DEFAULT_TIMELINE_LENGTH_TICKS } from '../types/timeline'

const defaultState = (): TimelineState => ({
  targetVersion: '',
  lengthTicks: DEFAULT_TIMELINE_LENGTH_TICKS,
  markers: [],
})

export function useTimeline(initial?: TimelineState) {
  const [state, setState] = useState<TimelineState>(initial ?? defaultState())

  const addMarker = useCallback(
    (partial: Partial<Marker> & { tick: Tick }): string => {
      const id = uuidv4()
      setState(produce((draft) => {
        draft.markers.push({
          id,
          tick: partial.tick,
          soundId: partial.soundId ?? '',
          variantIndex: partial.variantIndex ?? -1,
          volume: partial.volume ?? 1.0,
          pitch: partial.pitch ?? 1.0,
          duration: partial.duration,
          retriggerInterval: partial.retriggerInterval,
          volumeCurve: partial.volumeCurve,
          pitchCurve: partial.pitchCurve,
        })
      }))
      return id
    },
    [],
  )

  const removeMarker = useCallback((id: string) => {
    setState(produce((draft) => {
      draft.markers = draft.markers.filter(m => m.id !== id)
    }))
  }, [])

  const moveMarker = useCallback((id: string, newTick: Tick) => {
    setState(produce((draft) => {
      const m = draft.markers.find(m => m.id === id)
      if (m) m.tick = Math.max(0, Math.trunc(newTick))
    }))
  }, [])

  const updateMarker = useCallback((id: string, patch: Partial<Marker>) => {
    setState(produce((draft) => {
      const m = draft.markers.find(m => m.id === id)
      if (!m) return
      Object.assign(m, patch)
    }))
  }, [])

  const setLength = useCallback((ticks: Tick) => {
    setState(produce((draft) => { draft.lengthTicks = Math.max(1, Math.trunc(ticks)) }))
  }, [])

  const setTargetVersion = useCallback((v: string) => {
    setState(produce((draft) => { draft.targetVersion = v }))
  }, [])

  const replaceAll = useCallback((next: TimelineState) => {
    setState(next)
  }, [])

  return {
    state,
    addMarker,
    removeMarker,
    moveMarker,
    updateMarker,
    setLength,
    setTargetVersion,
    replaceAll,
  }
}
