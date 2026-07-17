// 1 tick = 1/20 秒 = 50ms
export type Tick = number

export interface Keyframe {
  tick: Tick
  value: number
  interpolation: 'linear' | 'bezier'
  handleL?: { dt: number, dv: number }
  handleR?: { dt: number, dv: number }
}

export interface Curve {
  keyframes: Keyframe[]
}

export interface Marker {
  id: string
  tick: Tick
  soundId: string
  variantIndex: number
  volume: number
  pitch: number
  duration?: Tick
  retriggerInterval?: Tick
  volumeCurve?: Curve
  pitchCurve?: Curve
  /** Timeline track Y coordinate. Undefined means automatic lane placement. */
  trackY?: number
}

export interface TimelineState {
  targetVersion: string
  lengthTicks: Tick
  markers: Marker[]
}

export interface TimelineFile extends TimelineState {
  format: 'knead-project'
  version: 1
}

export const DEFAULT_TIMELINE_LENGTH_TICKS = 200
export const DEFAULT_RETRIGGER_INTERVAL = 1
export const SINGLE_SHOT_CURVE_PREVIEW_TICKS = 20
export const TIMELINE_TRACK_HEIGHT = 120
export const TIMELINE_MARKER_SIZE = 16

export function getTimelineTrackHeight(markers: Marker[]): number {
  const countByTick = new Map<number, number>()
  let maxAtSameTick = 0
  let manualBottom = 0
  for (const marker of markers) {
    const count = (countByTick.get(marker.tick) ?? 0) + 1
    countByTick.set(marker.tick, count)
    maxAtSameTick = Math.max(maxAtSameTick, count)
    if (marker.trackY !== undefined) {
      manualBottom = Math.max(manualBottom, marker.trackY + TIMELINE_MARKER_SIZE / 2)
    }
  }
  return Math.max(
    TIMELINE_TRACK_HEIGHT,
    maxAtSameTick * TIMELINE_MARKER_SIZE + TIMELINE_MARKER_SIZE,
    Math.ceil(manualBottom),
  )
}
