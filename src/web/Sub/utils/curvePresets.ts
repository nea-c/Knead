import type { Keyframe } from '../types/timeline'

export type EasePreset = 'ease-in' | 'ease-out' | 'ease-in-out'

export interface CurveViewport {
  tickMin: number
  tickMax: number
  valueMin: number
  valueMax: number
}

export function calculateCurveViewport(
  keyframes: Keyframe[], duration: number, valueMin: number, valueMax: number,
): CurveViewport {
  const ticks = [0, duration]
  const values = [valueMin, valueMax]
  for (const keyframe of keyframes) {
    ticks.push(keyframe.tick)
    values.push(keyframe.value)
    if (keyframe.interpolation !== 'bezier') continue
    if (keyframe.handleL) {
      ticks.push(keyframe.tick + keyframe.handleL.dt)
      values.push(keyframe.value + keyframe.handleL.dv)
    }
    if (keyframe.handleR) {
      ticks.push(keyframe.tick + keyframe.handleR.dt)
      values.push(keyframe.value + keyframe.handleR.dv)
    }
  }
  const rawTickMin = Math.min(...ticks)
  const rawTickMax = Math.max(...ticks)
  const rawValueMin = Math.min(...values)
  const rawValueMax = Math.max(...values)
  const tickPadding = Math.max(rawTickMax - rawTickMin, 1) * 0.08
  const valuePadding = Math.max(rawValueMax - rawValueMin, 0.01) * 0.08
  return {
    tickMin: rawTickMin < 0 ? rawTickMin - tickPadding : 0,
    tickMax: rawTickMax > duration ? rawTickMax + tickPadding : duration,
    valueMin: rawValueMin < valueMin ? rawValueMin - valuePadding : valueMin,
    valueMax: rawValueMax > valueMax ? rawValueMax + valuePadding : valueMax,
  }
}

export function applyEasePreset(
  keyframes: Keyframe[],
  selectedIndices: Iterable<number>,
  preset: EasePreset,
): Keyframe[] {
  const next = keyframes.map(keyframe => ({ ...keyframe }))
  const indices = Array.from(new Set(selectedIndices)).sort((a, b) => a - b)

  for (const index of indices) {
    const start = next[index]
    const end = next[index + 1]
    if (!start || !end) continue
    const tickDelta = end.tick - start.tick
    if (tickDelta <= 0) continue

    const handleTick = tickDelta / 3
    const handleValue = (end.value - start.value) / 3
    start.interpolation = 'bezier'
    start.handleR = {
      dt: handleTick,
      dv: preset === 'ease-in' || preset === 'ease-in-out' ? 0 : handleValue,
    }
    end.handleL = {
      dt: -handleTick,
      dv: preset === 'ease-out' || preset === 'ease-in-out' ? 0 : -handleValue,
    }
  }

  return next
}

export function _selfCheckCurvePresets(): void {
  const source: Keyframe[] = [
    { tick: 0, value: 0, interpolation: 'linear' },
    { tick: 12, value: 1, interpolation: 'linear' },
  ]
  const easeIn = applyEasePreset(source, [0], 'ease-in')
  if (easeIn[0].interpolation !== 'bezier') throw new Error('Ease In did not enable bezier')
  if (easeIn[0].handleR?.dt !== 4 || easeIn[0].handleR?.dv !== 0) {
    throw new Error('Ease In start handle mismatch')
  }
  if (easeIn[1].handleL?.dt !== -4 || easeIn[1].handleL?.dv !== -1 / 3) {
    throw new Error('Ease In end handle mismatch')
  }
  if (source[0].interpolation !== 'linear') throw new Error('Preset mutated source')

  const easeOut = applyEasePreset(source, [0], 'ease-out')
  if (easeOut[0].handleR?.dv !== 1 / 3 || easeOut[1].handleL?.dv !== 0) {
    throw new Error('Ease Out handle mismatch')
  }

  const easeInOut = applyEasePreset(source, [0], 'ease-in-out')
  if (easeInOut[0].handleR?.dv !== 0 || easeInOut[1].handleL?.dv !== 0) {
    throw new Error('Ease InOut handle mismatch')
  }

  const fitted = calculateCurveViewport([
    { ...source[0], interpolation: 'bezier', handleL: { dt: -6, dv: 2 } },
    { ...source[1], interpolation: 'bezier', handleR: { dt: 6, dv: -2 } },
  ], 12, 0, 1)
  if (fitted.tickMin >= -6 || fitted.tickMax <= 18 || fitted.valueMin >= -1 || fitted.valueMax <= 2) {
    throw new Error('Curve viewport did not include overshooting handles')
  }

  console.log('curvePresets self-check OK')
}
