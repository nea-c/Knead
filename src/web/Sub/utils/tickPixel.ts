import type { Tick } from '../types/timeline'

export const DEFAULT_PX_PER_TICK = 8

export function tickToPx(tick: Tick, pxPerTick: number): number {
  return Math.round(tick * pxPerTick)
}

export function pxToTick(px: number, pxPerTick: number): Tick {
  const t = Math.round(px / pxPerTick)
  return t < 0 ? 0 : t
}

export function snapPxToTick(px: number, pxPerTick: number): number {
  return tickToPx(pxToTick(px, pxPerTick), pxPerTick)
}

// 手動セルフチェック（ファイル末尾に追加、開発時のみ手で呼ぶ）
export function _selfCheckTickPixel(): void {
  const cases: Array<[number, number, number]> = [
    // [tick, pxPerTick, expectedPx]
    [0, 8, 0], [1, 8, 8], [10, 8, 80], [3, 4, 12],
  ]
  for (const [t, ppt, expected] of cases) {
    const got = tickToPx(t, ppt)
    if (got !== expected) throw new Error(`tickToPx(${t}, ${ppt}) => ${got}, expected ${expected}`)
  }
  const pxCases: Array<[number, number, number]> = [
    [0, 8, 0], [4, 8, 1], [7, 8, 1], [8, 8, 1], [12, 8, 2], [-5, 8, 0],
  ]
  for (const [px, ppt, expected] of pxCases) {
    const got = pxToTick(px, ppt)
    if (got !== expected) throw new Error(`pxToTick(${px}, ${ppt}) => ${got}, expected ${expected}`)
  }
  console.log('tickPixel self-check OK')
}
