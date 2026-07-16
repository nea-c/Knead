import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text } from '@yamada-ui/react'
import type { Curve, Keyframe } from '../types/timeline'
import { sampleCurve } from '../utils/curveSampling'

interface Props {
  label: string
  duration: number
  valueMin: number
  valueMax: number
  fallback: number
  curve: Curve | undefined
  onChange: (next: Curve | undefined) => void
  width?: number
  height?: number
}

const PAD = { l: 32, r: 8, t: 8, b: 20 }

const DEFAULT_BEZIER_HANDLE = 4 // dt

interface DragState {
  type: 'kf' | 'handleL' | 'handleR'
  index: number
  startX: number
  startY: number
  origTick: number
  origValue: number
  origHandleL?: { dt: number, dv: number }
  origHandleR?: { dt: number, dv: number }
}

export const CurveEditor: React.FC<Props> = ({
  label, duration, valueMin, valueMax, fallback, curve, onChange,
  width = 400, height = 140,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [dragState, setDragState] = useState<DragState | null>(null)

  const kfs: Keyframe[] = useMemo(() => curve?.keyframes ?? [], [curve])

  const plotW = width - PAD.l - PAD.r
  const plotH = height - PAD.t - PAD.b

  const tickToX = useCallback((t: number) => PAD.l + (duration > 0 ? (t / duration) * plotW : 0), [duration, plotW])
  const valueToY = useCallback((v: number) => {
    const norm = (v - valueMin) / (valueMax - valueMin)
    return PAD.t + (1 - norm) * plotH
  }, [valueMin, valueMax, plotH])
  const xToTick = useCallback((x: number) => Math.max(0, Math.min(duration, (x - PAD.l) / plotW * duration)), [duration, plotW])
  const yToValue = useCallback((y: number) => {
    const norm = 1 - (y - PAD.t) / plotH
    return Math.max(valueMin, Math.min(valueMax, valueMin + norm * (valueMax - valueMin)))
  }, [valueMin, valueMax, plotH])

  const pathD = useMemo(() => {
    if (kfs.length === 0) {
      const y = valueToY(fallback)
      return `M ${PAD.l} ${y} L ${PAD.l + plotW} ${y}`
    }
    const steps = 60
    const parts: string[] = []
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * duration
      const v = sampleCurve(curve, t, fallback)
      const cmd = i === 0 ? 'M' : 'L'
      parts.push(`${cmd} ${tickToX(t).toFixed(2)} ${valueToY(v).toFixed(2)}`)
    }
    return parts.join(' ')
  }, [kfs, curve, fallback, duration, plotW, tickToX, valueToY])

  const commitCurve = useCallback((newKfs: Keyframe[]) => {
    if (newKfs.length === 0) onChange(undefined)
    else onChange({ keyframes: [...newKfs].sort((a, b) => a.tick - b.tick) })
  }, [onChange])

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    // Shift+クリックでキーフレーム追加
    if (e.shiftKey) {
      e.preventDefault()
      const newKf: Keyframe = {
        tick: xToTick(x),
        value: yToValue(y),
        interpolation: 'linear',
      }
      commitCurve([...kfs, newKf])
      return
    }
    // 通常クリックで選択解除
    setSelected(new Set())
  }, [xToTick, yToValue, kfs, commitCurve])

  const handleKfPointerDown = useCallback((i: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(i)) next.delete(i)
        else next.add(i)
        return next
      })
    } else if (!selected.has(i)) {
      setSelected(new Set([i]))
    }
    const kf = kfs[i]
    setDragState({
      type: 'kf', index: i,
      startX: e.clientX, startY: e.clientY,
      origTick: kf.tick, origValue: kf.value,
    })
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }, [selected, kfs])

  const handleHandlePointerDown = useCallback((i: number, side: 'L' | 'R') => (e: React.PointerEvent) => {
    e.stopPropagation()
    const kf = kfs[i]
    setDragState({
      type: side === 'L' ? 'handleL' : 'handleR', index: i,
      startX: e.clientX, startY: e.clientY,
      origTick: kf.tick, origValue: kf.value,
      origHandleL: kf.handleL,
      origHandleR: kf.handleR,
    })
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }, [kfs])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragState
    if (!d) return
    if (!svgRef.current) return
    const dxPx = e.clientX - d.startX
    const dyPx = e.clientY - d.startY
    const dtick = dxPx / plotW * duration
    const dvalue = -dyPx / plotH * (valueMax - valueMin)
    const newKfs = kfs.map((kf, i) => {
      if (i !== d.index) return kf
      if (d.type === 'kf') {
        const newTick = Math.max(0, Math.min(duration, d.origTick + dtick))
        const newValue = Math.max(valueMin, Math.min(valueMax, d.origValue + dvalue))
        return { ...kf, tick: newTick, value: newValue }
      }
      if (d.type === 'handleL') {
        return {
          ...kf,
          handleL: {
            dt: (d.origHandleL?.dt ?? -DEFAULT_BEZIER_HANDLE) + dtick,
            dv: (d.origHandleL?.dv ?? 0) + dvalue,
          },
        }
      }
      if (d.type === 'handleR') {
        return {
          ...kf,
          handleR: {
            dt: (d.origHandleR?.dt ?? DEFAULT_BEZIER_HANDLE) + dtick,
            dv: (d.origHandleR?.dv ?? 0) + dvalue,
          },
        }
      }
      return kf
    })
    onChange({ keyframes: newKfs })
  }, [dragState, kfs, plotW, plotH, duration, valueMax, valueMin, onChange])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragState) {
      const d = dragState
      if (d.type === 'kf') {
        commitCurve(kfs.map((kf, i) => {
          if (i !== d.index) return kf
          return { ...kf, tick: Math.max(0, Math.min(duration, kf.tick)) }
        }))
      }
      setDragState(null)
      try { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId) }
      catch { /* noop */ }
    }
  }, [dragState, kfs, duration, commitCurve])

  // キーボード操作: T = Linear/Bezier toggle, Delete = remove
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (selected.size === 0) return
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        const newKfs = kfs.map((kf, i) => {
          if (!selected.has(i)) return kf
          if (kf.interpolation === 'linear') {
            return {
              ...kf,
              interpolation: 'bezier' as const,
              handleL: kf.handleL ?? { dt: -DEFAULT_BEZIER_HANDLE, dv: 0 },
              handleR: kf.handleR ?? { dt: DEFAULT_BEZIER_HANDLE, dv: 0 },
            }
          }
          return { ...kf, interpolation: 'linear' as const }
        })
        commitCurve(newKfs)
      }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const newKfs = kfs.filter((_, i) => !selected.has(i))
        setSelected(new Set())
        commitCurve(newKfs)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, kfs, commitCurve])

  return (
    <Box>
      <Text fontSize="sm" color="gray.400" mb="1">{label}</Text>
      <svg
        ref={svgRef}
        width={width} height={height}
        style={{ background: '#111827', border: '1px solid #374151', borderRadius: 4, cursor: 'crosshair', userSelect: 'none' }}
        onPointerDown={handleBgPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* グリッド */}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + plotH} stroke="#374151" />
        <line x1={PAD.l} y1={PAD.t + plotH} x2={PAD.l + plotW} y2={PAD.t + plotH} stroke="#374151" />
        {/* Y 軸ラベル */}
        <text x={PAD.l - 4} y={PAD.t + 4} textAnchor="end" fill="#9ca3af" fontSize="10">{valueMax.toFixed(2)}</text>
        <text x={PAD.l - 4} y={PAD.t + plotH} textAnchor="end" fill="#9ca3af" fontSize="10">{valueMin.toFixed(2)}</text>
        {/* X 軸ラベル */}
        <text x={PAD.l} y={height - 4} fill="#9ca3af" fontSize="10">0</text>
        <text x={PAD.l + plotW} y={height - 4} textAnchor="end" fill="#9ca3af" fontSize="10">{duration}</text>
        {/* カーブ */}
        <path d={pathD} stroke="#3b82f6" strokeWidth={2} fill="none" pointerEvents="none" />
        {/* キーフレーム + ハンドル */}
        {kfs.map((kf, i) => {
          const cx = tickToX(kf.tick)
          const cy = valueToY(kf.value)
          const isSel = selected.has(i)
          return (
            <g key={i}>
              {kf.interpolation === 'bezier' && isSel && (
                <>
                  {kf.handleL && (
                    <>
                      <line
                        x1={cx} y1={cy}
                        x2={tickToX(kf.tick + kf.handleL.dt)} y2={valueToY(kf.value + kf.handleL.dv)}
                        stroke="#f59e0b"
                      />
                      <circle
                        cx={tickToX(kf.tick + kf.handleL.dt)} cy={valueToY(kf.value + kf.handleL.dv)}
                        r={4} fill="#f59e0b" cursor="grab"
                        onPointerDown={handleHandlePointerDown(i, 'L')}
                      />
                    </>
                  )}
                  {kf.handleR && (
                    <>
                      <line
                        x1={cx} y1={cy}
                        x2={tickToX(kf.tick + kf.handleR.dt)} y2={valueToY(kf.value + kf.handleR.dv)}
                        stroke="#f59e0b"
                      />
                      <circle
                        cx={tickToX(kf.tick + kf.handleR.dt)} cy={valueToY(kf.value + kf.handleR.dv)}
                        r={4} fill="#f59e0b" cursor="grab"
                        onPointerDown={handleHandlePointerDown(i, 'R')}
                      />
                    </>
                  )}
                </>
              )}
              <circle
                cx={cx} cy={cy}
                r={5}
                fill={isSel ? '#fbbf24' : (kf.interpolation === 'bezier' ? '#a78bfa' : '#60a5fa')}
                stroke={isSel ? '#fde68a' : '#1f2937'}
                strokeWidth={2}
                cursor="grab"
                onPointerDown={handleKfPointerDown(i)}
              />
            </g>
          )
        })}
      </svg>
      <Text fontSize="xs" color="gray.500" mt="1">
        Shift+クリックで追加 / ドラッグで移動 / T で Linear⇔Bezier / Delete で削除
      </Text>
    </Box>
  )
}
