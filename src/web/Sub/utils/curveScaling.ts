import type { Curve, Keyframe } from '../types/timeline'
import { constrainHandleDt, type HandleSide } from './curveHandles'

const TIME_PRECISION = 12

function stableTime(value: number): number {
  return Number(value.toPrecision(TIME_PRECISION))
}

function scaleHandle(
  handle: Keyframe['handleL'] | Keyframe['handleR'],
  scale: number,
  side: HandleSide,
): Keyframe['handleL'] | undefined {
  if (!handle) return undefined
  return { ...handle, dt: constrainHandleDt(side, stableTime(handle.dt * scale)) }
}

/** Keep every horizontal curve coordinate at the same duration-relative position. */
export function scaleCurveDuration(
  curve: Curve | undefined,
  oldDuration: number,
  newDuration: number,
): Curve | undefined {
  if (!curve) return undefined
  if (oldDuration <= 0 || newDuration <= 0) return curve

  const scale = newDuration / oldDuration
  return {
    keyframes: curve.keyframes
      .map(keyframe => ({
        ...keyframe,
        tick: stableTime(
          Math.max(0, Math.min(1, keyframe.tick / oldDuration)) * newDuration,
        ),
        handleL: scaleHandle(keyframe.handleL, scale, 'L'),
        handleR: scaleHandle(keyframe.handleR, scale, 'R'),
      }))
      .sort((a, b) => a.tick - b.tick),
  }
}

export function _selfCheckCurveScaling(): void {
  const source: Curve = {
    keyframes: [
      {
        tick: 5,
        value: 0.25,
        interpolation: 'bezier',
        handleL: { dt: -2, dv: 0.1 },
        handleR: { dt: 3, dv: -0.1 },
      },
      { tick: 10, value: 1, interpolation: 'linear' },
    ],
  }

  const scaled = scaleCurveDuration(source, 20, 37)
  if (!scaled) throw new Error('Curve scaling returned undefined')
  if (scaled.keyframes[0].tick !== 9.25 || scaled.keyframes[1].tick !== 18.5) {
    throw new Error('Keyframe duration ratio was not preserved')
  }
  if (scaled.keyframes[0].handleL?.dt !== -3.7 || scaled.keyframes[0].handleR?.dt !== 5.55) {
    throw new Error('Bezier handle duration ratio was not preserved')
  }
  if (scaled.keyframes[0].handleL?.dv !== 0.1 || scaled.keyframes[0].handleR?.dv !== -0.1) {
    throw new Error('Bezier handle value offset changed during duration scaling')
  }

  const restored = scaleCurveDuration(scaled, 37, 20)
  if (!restored) throw new Error('Restored curve is undefined')
  if (restored.keyframes[0].tick !== 5 || restored.keyframes[0].handleL?.dt !== -2) {
    throw new Error('Curve coordinates drifted after restoring duration')
  }

  const compressed = scaleCurveDuration({
    keyframes: [
      { tick: 1, value: 0, interpolation: 'linear' },
      { tick: 2, value: 1, interpolation: 'linear' },
    ],
  }, 100, 2)
  if (!compressed || compressed.keyframes[0].tick === compressed.keyframes[1].tick) {
    throw new Error('Distinct keyframes collided while scaling duration')
  }

  console.log('curveScaling self-check OK')
}
