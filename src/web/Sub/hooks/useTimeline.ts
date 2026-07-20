import { useCallback, useMemo, useReducer } from 'react'
import { produce, Draft } from 'immer'
import { v4 as uuidv4 } from 'uuid'
import type { Curve, Marker, Tick, TimelineState } from '../types/timeline'
import {
  DEFAULT_RETRIGGER_INTERVAL,
  DEFAULT_TIMELINE_LENGTH_TICKS,
  getTimelineLengthTicks,
  SINGLE_SHOT_CURVE_PREVIEW_TICKS,
} from '../types/timeline'
import { scaleCurveDuration } from '../utils/curveScaling'

const MAX_HISTORY = 100

function resizeMarkerCurves(marker: Draft<Marker>, duration: number): void {
  const oldSpan = marker.duration && marker.duration > 0
    ? marker.duration
    : SINGLE_SHOT_CURVE_PREVIEW_TICKS
  const newSpan = duration > 0 ? duration : SINGLE_SHOT_CURVE_PREVIEW_TICKS
  marker.volumeCurve = scaleCurveDuration(marker.volumeCurve as Curve | undefined, oldSpan, newSpan)
  marker.pitchCurve = scaleCurveDuration(marker.pitchCurve as Curve | undefined, oldSpan, newSpan)
}

function changesDuration(patch: Partial<Marker>, marker: Draft<Marker>): boolean {
  return Object.prototype.hasOwnProperty.call(patch, 'duration') && patch.duration !== marker.duration
}

function syncTimelineLength(draft: Draft<TimelineState>): void {
  draft.lengthTicks = getTimelineLengthTicks(draft.markers)
}

const defaultState = (): TimelineState => ({
  targetVersion: '',
  lengthTicks: DEFAULT_TIMELINE_LENGTH_TICKS,
  markers: [],
})

interface History {
  past: TimelineState[]
  current: TimelineState
  future: TimelineState[]
  txSnapshot: TimelineState | null
}

type Action =
  | { type: 'mutate', recipe: (d: Draft<TimelineState>) => void }
  | { type: 'beginTx' }
  | { type: 'commitTx' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace', state: TimelineState }

function reducer(h: History, a: Action): History {
  switch (a.type) {
    case 'mutate': {
      const next = produce(h.current, a.recipe)
      if (next === h.current) return h
      if (h.txSnapshot !== null) return { ...h, current: next }
      return {
        past: [...h.past, h.current].slice(-MAX_HISTORY),
        current: next,
        future: [],
        txSnapshot: null,
      }
    }
    case 'beginTx':
      if (h.txSnapshot !== null) return h
      return { ...h, txSnapshot: h.current }
    case 'commitTx': {
      if (h.txSnapshot === null) return h
      if (h.txSnapshot === h.current) return { ...h, txSnapshot: null }
      return {
        past: [...h.past, h.txSnapshot].slice(-MAX_HISTORY),
        current: h.current,
        future: [],
        txSnapshot: null,
      }
    }
    case 'undo': {
      if (h.past.length === 0) return h
      const prev = h.past[h.past.length - 1]
      return {
        past: h.past.slice(0, -1),
        current: prev,
        future: [h.current, ...h.future].slice(0, MAX_HISTORY),
        txSnapshot: null,
      }
    }
    case 'redo': {
      if (h.future.length === 0) return h
      const next = h.future[0]
      return {
        past: [...h.past, h.current].slice(-MAX_HISTORY),
        current: next,
        future: h.future.slice(1),
        txSnapshot: null,
      }
    }
    case 'replace':
      return { past: [], current: a.state, future: [], txSnapshot: null }
  }
}

export function useTimeline(initial?: TimelineState) {
  const [h, dispatch] = useReducer(reducer, undefined, () => ({
    past: [], current: initial ?? defaultState(), future: [], txSnapshot: null,
  }))

  const addMarker = useCallback(
    (partial: Partial<Marker> & { tick: Tick }): string => {
      const id = uuidv4()
      dispatch({
        type: 'mutate',
        recipe: (draft) => {
          draft.markers.push({
            id,
            tick: Math.max(0, Math.trunc(partial.tick)),
            soundId: partial.soundId ?? '',
            variantIndex: partial.variantIndex ?? -1,
            volume: partial.volume ?? 1.0,
            pitch: partial.pitch ?? 1.0,
            duration: partial.duration,
            retriggerInterval: partial.retriggerInterval ?? DEFAULT_RETRIGGER_INTERVAL,
            volumeCurve: partial.volumeCurve,
            pitchCurve: partial.pitchCurve,
            trackY: partial.trackY,
          })
          syncTimelineLength(draft)
        },
      })
      return id
    },
    [],
  )

  const addMarkers = useCallback((partials: (Partial<Marker> & { tick: Tick })[]): string[] => {
    const ids = partials.map(() => uuidv4())
    dispatch({
      type: 'mutate',
      recipe: (draft) => {
        partials.forEach((p, i) => {
          draft.markers.push({
            id: ids[i],
            tick: Math.max(0, Math.trunc(p.tick)),
            soundId: p.soundId ?? '',
            variantIndex: p.variantIndex ?? -1,
            volume: p.volume ?? 1.0,
            pitch: p.pitch ?? 1.0,
            duration: p.duration,
            retriggerInterval: p.retriggerInterval ?? DEFAULT_RETRIGGER_INTERVAL,
            volumeCurve: p.volumeCurve,
            pitchCurve: p.pitchCurve,
            trackY: p.trackY,
          })
        })
        syncTimelineLength(draft)
      },
    })
    return ids
  }, [])

  const removeMarker = useCallback((id: string) => {
    dispatch({
      type: 'mutate',
      recipe: (draft) => {
        draft.markers = draft.markers.filter(m => m.id !== id)
        syncTimelineLength(draft)
      },
    })
  }, [])

  const removeMarkers = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    dispatch({
      type: 'mutate',
      recipe: (draft) => {
        draft.markers = draft.markers.filter(m => !idSet.has(m.id))
        syncTimelineLength(draft)
      },
    })
  }, [])

  const moveMarker = useCallback((id: string, newTick: Tick) => {
    dispatch({
      type: 'mutate',
      recipe: (draft) => {
        const m = draft.markers.find(m => m.id === id)
        if (!m) return
        m.tick = Math.max(0, Math.trunc(newTick))
        syncTimelineLength(draft)
      },
    })
  }, [])

  const moveMarkers = useCallback((deltas: Map<string, Tick>) => {
    if (deltas.size === 0) return
    dispatch({
      type: 'mutate',
      recipe: (draft) => {
        for (const m of draft.markers) {
          const next = deltas.get(m.id)
          if (next === undefined) continue
          m.tick = Math.max(0, Math.trunc(next))
        }
        syncTimelineLength(draft)
      },
    })
  }, [])

  const moveMarkersOnTrack = useCallback((positions: Map<string, { tick: Tick, trackY?: number }>) => {
    if (positions.size === 0) return
    dispatch({
      type: 'mutate',
      recipe: (draft) => {
        for (const m of draft.markers) {
          const next = positions.get(m.id)
          if (next === undefined) continue
          m.tick = Math.max(0, Math.trunc(next.tick))
          m.trackY = next.trackY
        }
        syncTimelineLength(draft)
      },
    })
  }, [])

  const updateMarker = useCallback((id: string, patch: Partial<Marker>) => {
    dispatch({
      type: 'mutate',
      recipe: (draft) => {
        const m = draft.markers.find(m => m.id === id)
        if (!m) return
        if (changesDuration(patch, m)) {
          resizeMarkerCurves(m, patch.duration ?? 0)
        }
        Object.assign(m, patch)
        if (patch.tick !== undefined) {
          m.tick = Math.max(0, Math.trunc(patch.tick))
        }
        syncTimelineLength(draft)
      },
    })
  }, [])

  const updateMarkers = useCallback((ids: string[], patch: Partial<Marker>) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    dispatch({
      type: 'mutate',
      recipe: (draft) => {
        for (const m of draft.markers) {
          if (!idSet.has(m.id)) continue
          if (changesDuration(patch, m)) {
            resizeMarkerCurves(m, patch.duration ?? 0)
          }
          Object.assign(m, patch)
          if (patch.tick !== undefined) {
            m.tick = Math.max(0, Math.trunc(patch.tick))
          }
        }
        syncTimelineLength(draft)
      },
    })
  }, [])

  const setTargetVersion = useCallback((v: string) => {
    dispatch({
      type: 'mutate',
      recipe: (draft) => { draft.targetVersion = v },
    })
  }, [])

  const replaceAll = useCallback((next: TimelineState) => {
    dispatch({
      type: 'replace',
      state: { ...next, lengthTicks: getTimelineLengthTicks(next.markers) },
    })
  }, [])

  const beginTransaction = useCallback(() => {
    dispatch({ type: 'beginTx' })
  }, [])

  const commitTransaction = useCallback(() => {
    dispatch({ type: 'commitTx' })
  }, [])

  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  return useMemo(() => ({
    state: h.current,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    addMarker,
    addMarkers,
    removeMarker,
    removeMarkers,
    moveMarker,
    moveMarkers,
    moveMarkersOnTrack,
    updateMarker,
    updateMarkers,
    setTargetVersion,
    replaceAll,
    beginTransaction,
    commitTransaction,
    undo,
    redo,
  }), [
    h.current, h.past.length, h.future.length,
    addMarker, addMarkers, removeMarker, removeMarkers,
    moveMarker, moveMarkers, moveMarkersOnTrack, updateMarker, updateMarkers,
    setTargetVersion, replaceAll,
    beginTransaction, commitTransaction, undo, redo,
  ])
}
