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
