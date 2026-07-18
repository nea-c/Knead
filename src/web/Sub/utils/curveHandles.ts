import type { Curve } from '../types/timeline'

export type HandleSide = 'L' | 'R'

export function constrainHandleDt(side: HandleSide, dt: number): number {
  return side === 'L' ? Math.min(0, dt) : Math.max(0, dt)
}

export function constrainCurveHandles(curve: Curve | undefined, duration: number): Curve | undefined {
  if (!curve) return undefined
  let changed = false
  const keyframes = curve.keyframes.map((keyframe) => {
    const handleL = keyframe.tick > 0 && keyframe.handleL
      ? { ...keyframe.handleL, dt: constrainHandleDt('L', keyframe.handleL.dt) }
      : undefined
    const handleR = keyframe.tick < duration && keyframe.handleR
      ? { ...keyframe.handleR, dt: constrainHandleDt('R', keyframe.handleR.dt) }
      : undefined
    if (handleL?.dt === keyframe.handleL?.dt && handleR?.dt === keyframe.handleR?.dt) {
      return keyframe
    }
    changed = true
    return { ...keyframe, handleL, handleR }
  })
  return changed ? { keyframes } : curve
}

export function _selfCheckCurveHandles(): void {
  if (constrainHandleDt('L', 4) !== 0) throw new Error('Left handle crossed its control point')
  if (constrainHandleDt('L', -4) !== -4) throw new Error('Valid left handle was changed')
  if (constrainHandleDt('R', -4) !== 0) throw new Error('Right handle crossed its control point')
  if (constrainHandleDt('R', 4) !== 4) throw new Error('Valid right handle was changed')

  const constrained = constrainCurveHandles({
    keyframes: [
      {
        tick: 0, value: 0, interpolation: 'bezier',
        handleL: { dt: -2, dv: -0.5 }, handleR: { dt: -3, dv: 0.5 },
      },
      {
        tick: 10, value: 1, interpolation: 'bezier',
        handleL: { dt: 2, dv: -0.25 }, handleR: { dt: -3, dv: 0.25 },
      },
      {
        tick: 20, value: 0, interpolation: 'linear',
        handleL: { dt: 2, dv: -0.5 }, handleR: { dt: 3, dv: 0.5 },
      },
    ],
  }, 20)
  const first = constrained?.keyframes[0]
  const middle = constrained?.keyframes[1]
  const last = constrained?.keyframes[2]
  if (first?.handleL !== undefined || last?.handleR !== undefined) {
    throw new Error('Outward endpoint handles were not removed')
  }
  if (first?.handleR?.dt !== 0 || middle?.handleL?.dt !== 0 || middle.handleR?.dt !== 0 || last?.handleL?.dt !== 0) {
    throw new Error('Curve handles were not constrained to their own side')
  }
  if (middle.handleL?.dv !== -0.25 || middle.handleR?.dv !== 0.25) {
    throw new Error('Constraining handle time changed its value offset')
  }

  const partialCurve = constrainCurveHandles({
    keyframes: [
      {
        tick: 5, value: 0, interpolation: 'bezier',
        handleL: { dt: -1, dv: 0 }, handleR: { dt: 1, dv: 0 },
      },
      {
        tick: 15, value: 1, interpolation: 'linear',
        handleL: { dt: -1, dv: 0 }, handleR: { dt: 1, dv: 0 },
      },
    ],
  }, 20)
  if (!partialCurve?.keyframes[0].handleL || !partialCurve.keyframes[1].handleR) {
    throw new Error('Handles on non-endpoint keyframes were removed')
  }

  console.log('curveHandles self-check OK')
}
