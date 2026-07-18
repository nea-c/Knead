import type { Curve } from '../types/timeline'

export type HandleSide = 'L' | 'R'

export function constrainHandleDt(side: HandleSide, dt: number): number {
  return side === 'L' ? Math.min(0, dt) : Math.max(0, dt)
}

export function constrainCurveHandles(curve: Curve | undefined): Curve | undefined {
  if (!curve) return undefined
  let changed = false
  const keyframes = curve.keyframes.map(keyframe => {
    const handleL = keyframe.handleL
      ? { ...keyframe.handleL, dt: constrainHandleDt('L', keyframe.handleL.dt) }
      : undefined
    const handleR = keyframe.handleR
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
    keyframes: [{
      tick: 10,
      value: 1,
      interpolation: 'bezier',
      handleL: { dt: 2, dv: -0.25 },
      handleR: { dt: -3, dv: 0.25 },
    }],
  })
  const keyframe = constrained?.keyframes[0]
  if (keyframe?.handleL?.dt !== 0 || keyframe.handleR?.dt !== 0) {
    throw new Error('Curve handles were not constrained to their own side')
  }
  if (keyframe.handleL?.dv !== -0.25 || keyframe.handleR?.dv !== 0.25) {
    throw new Error('Constraining handle time changed its value offset')
  }

  console.log('curveHandles self-check OK')
}
