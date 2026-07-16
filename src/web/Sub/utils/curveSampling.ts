import type { Curve, Keyframe } from '../types/timeline'

// 3 次ベジェの y を x から二分探索で求める
function bezierY(p0x: number, p0y: number, c1x: number, c1y: number,
  c2x: number, c2y: number, p1x: number, p1y: number,
  x: number): number {
  // 端の x でクランプ
  if (x <= p0x) return p0y
  if (x >= p1x) return p1y
  let lo = 0, hi = 1
  for (let i = 0; i < 20; i++) {
    const t = (lo + hi) / 2
    const mt = 1 - t
    const bx = mt * mt * mt * p0x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * p1x
    if (bx < x) lo = t
    else hi = t
  }
  const t = (lo + hi) / 2
  const mt = 1 - t
  return mt * mt * mt * p0y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * p1y
}

// tick はマーカー起点からの相対 tick
export function sampleCurve(curve: Curve | undefined, tick: number, fallback: number): number {
  if (!curve || curve.keyframes.length === 0) return fallback
  const kfs = curve.keyframes
  if (kfs.length === 1) return kfs[0].value
  if (tick <= kfs[0].tick) return kfs[0].value
  if (tick >= kfs[kfs.length - 1].tick) return kfs[kfs.length - 1].value
  // セグメント検索（昇順ソート済み前提）
  let i = 0
  for (; i < kfs.length - 1; i++) {
    if (tick >= kfs[i].tick && tick < kfs[i + 1].tick) break
  }
  const a: Keyframe = kfs[i]
  const b: Keyframe = kfs[i + 1]
  if (a.interpolation === 'linear' || !a.handleR || !b.handleL) {
    const t = (tick - a.tick) / (b.tick - a.tick)
    return a.value + (b.value - a.value) * t
  }
  const c1x = a.tick + (a.handleR?.dt ?? 0)
  const c1y = a.value + (a.handleR?.dv ?? 0)
  const c2x = b.tick + (b.handleL?.dt ?? 0)
  const c2y = b.value + (b.handleL?.dv ?? 0)
  return bezierY(a.tick, a.value, c1x, c1y, c2x, c2y, b.tick, b.value, tick)
}
