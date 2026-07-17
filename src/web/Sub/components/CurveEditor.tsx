import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Text } from '@yamada-ui/react'
import type { Curve, Keyframe } from '../types/timeline'
import { applyEasePreset, calculateCurveViewport, EasePreset } from '../utils/curvePresets'
import { sampleCurve } from '../utils/curveSampling'

interface Props {
  label: string
  duration: number
  valueMin: number
  valueMax: number
  fallback: number
  curve: Curve | undefined
  onChange: (next: Curve | undefined) => void
  onBeginEdit: () => void
  onEndEdit: () => void
  width?: number
  height?: number
  referenceValue?: number
  snapValues?: number[]
  valueTooltip?: boolean
  snapValueLabels?: string[]
}

const PAD = { l: 32, r: 8, t: 8, b: 20 }

const DEFAULT_BEZIER_HANDLE = 4 // dt

interface DragState {
  type: 'kf' | 'handleL' | 'handleR'
  index: number
  startX: number
  startY: number
  origins: Map<number, { tick: number, value: number }>
  viewTickSpan: number
  viewValueSpan: number
  origHandleL?: { dt: number, dv: number }
  origHandleR?: { dt: number, dv: number }
  lockTick?: boolean
}
export const CurveEditor: React.FC<Props> = ({
  label, duration, valueMin, valueMax, fallback, curve, onChange, onBeginEdit, onEndEdit,
  width = 400, height = 140, referenceValue, snapValues, valueTooltip = false, snapValueLabels,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [dragTooltip, setDragTooltip] = useState<{ x: number, y: number, value: number } | null>(null)

  const kfs: Keyframe[] = useMemo(() => {
    const keyframes = curve?.keyframes ?? []
    const withEndpoints = [...keyframes]
    if (!withEndpoints.some(kf => kf.tick === 0)) {
      withEndpoints.push({ tick: 0, value: fallback, interpolation: 'linear' })
    }
    if (!withEndpoints.some(kf => kf.tick === duration)) {
      withEndpoints.push({ tick: duration, value: fallback, interpolation: 'linear' })
    }
    return withEndpoints.sort((a, b) => a.tick - b.tick)
  }, [curve, duration, fallback])
  const effectiveCurve = useMemo(() => ({ keyframes: kfs }), [kfs])

  const plotW = width - PAD.l - PAD.r
  const plotH = height - PAD.t - PAD.b
  const viewport = useMemo(
    () => calculateCurveViewport(kfs, duration, valueMin, valueMax),
    [kfs, duration, valueMin, valueMax],
  )
  const viewTickSpan = Math.max(viewport.tickMax - viewport.tickMin, 1)
  const viewValueSpan = Math.max(viewport.valueMax - viewport.valueMin, 0.01)

  const tickToX = useCallback(
    (t: number) => PAD.l + ((t - viewport.tickMin) / viewTickSpan) * plotW,
    [viewport.tickMin, viewTickSpan, plotW],
  )
  const valueToY = useCallback((v: number) => {
    const norm = (v - viewport.valueMin) / viewValueSpan
    return PAD.t + (1 - norm) * plotH
  }, [viewport.valueMin, viewValueSpan, plotH])
  const xToTick = useCallback((x: number) => {
    const tick = viewport.tickMin + ((x - PAD.l) / plotW) * viewTickSpan
    return Math.round(Math.max(0, Math.min(duration, tick)))
  }, [viewport.tickMin, viewTickSpan, duration, plotW])
  const snapValue = useCallback((value: number) => {
    const clamped = Math.max(valueMin, Math.min(valueMax, value))
    if (!snapEnabled || !snapValues?.length) return clamped
    return snapValues.reduce((nearest, candidate) => (
      Math.abs(candidate - clamped) < Math.abs(nearest - clamped) ? candidate : nearest
    ))
  }, [valueMin, valueMax, snapEnabled, snapValues])
  const dragTooltipText = useMemo(() => {
    if (!dragTooltip) return ''
    const numeric = dragTooltip.value.toFixed(3)
    if (!snapEnabled || !snapValues?.length || !snapValueLabels?.length) return numeric
    const snapIndex = snapValues.reduce((nearestIndex, candidate, index) => (
      Math.abs(candidate - dragTooltip.value) < Math.abs(snapValues[nearestIndex] - dragTooltip.value)
        ? index
        : nearestIndex
    ), 0)
    return numeric + ' (' + snapValueLabels[snapIndex] + ')'
  }, [dragTooltip, snapEnabled, snapValues, snapValueLabels])
  const yToValue = useCallback((y: number) => {
    const norm = 1 - (y - PAD.t) / plotH
    const value = viewport.valueMin + norm * viewValueSpan
    return snapValue(value)
  }, [viewport.valueMin, viewValueSpan, plotH, snapValue])

  const pathD = useMemo(() => {
    const steps = 60
    const parts: string[] = []
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * duration
      const v = sampleCurve(effectiveCurve, t, fallback)
      const cmd = i === 0 ? 'M' : 'L'
      parts.push(`${cmd} ${tickToX(t).toFixed(2)} ${valueToY(v).toFixed(2)}`)
    }
    return parts.join(' ')
  }, [effectiveCurve, fallback, duration, tickToX, valueToY])

  const commitCurve = useCallback((newKfs: Keyframe[]): boolean => {
    if (newKfs.length === 0) {
      onChange(undefined)
      return true
    }
    const normalized = newKfs
      .map(kf => ({
        ...kf,
        tick: Math.round(Math.max(0, Math.min(duration, kf.tick))),
      }))
      .sort((a, b) => a.tick - b.tick)
    if (normalized.some((kf, i) => i > 0 && normalized[i - 1].tick === kf.tick)) return false
    onChange({ keyframes: normalized })
    return true
  }, [duration, onChange])
  const handleBgPointerDown = useCallback(() => {
    // 通常クリックで選択解除
    setSelected(new Set())
  }, [])
  const handleBgDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const tick = xToTick(e.clientX - rect.left)
    if (kfs.some(kf => kf.tick === tick)) return
    e.preventDefault()
    const newKf: Keyframe = {
      tick,
      value: yToValue(e.clientY - rect.top),
      interpolation: 'linear',
    }
    commitCurve([...kfs, newKf])
  }, [xToTick, yToValue, kfs, commitCurve])

  const handleKfPointerDown = useCallback((i: number) => (e: React.PointerEvent) => {
    if (e.button === 2) {
      e.preventDefault()
      e.stopPropagation()
      if (!selected.has(i)) setSelected(new Set([i]))
      setContextMenu({ x: e.clientX, y: e.clientY })
      return
    }
    if (e.button !== 0) return
    e.stopPropagation()
    const isToggle = e.ctrlKey || e.metaKey
    const nextSelected = new Set(selected)
    if (isToggle) {
      if (nextSelected.has(i)) {
        nextSelected.delete(i)
        setSelected(nextSelected)
        return
      }
      nextSelected.add(i)
    }
    else if (!nextSelected.has(i)) {
      nextSelected.clear()
      nextSelected.add(i)
    }
    setSelected(nextSelected)

    const origins = new Map<number, { tick: number, value: number }>()
    for (const selectedIndex of nextSelected) {
      const selectedKeyframe = kfs[selectedIndex]
      if (selectedKeyframe) {
        origins.set(selectedIndex, {
          tick: selectedKeyframe.tick,
          value: selectedKeyframe.value,
        })
      }
    }
    onBeginEdit()
    setDragState({
      type: 'kf',
      index: i,
      startX: e.clientX,
      startY: e.clientY,
      origins,
      lockTick: Array.from(origins.values()).some(origin => origin.tick === 0 || origin.tick === duration),
      viewTickSpan,
      viewValueSpan,
    })
    if (valueTooltip) setDragTooltip({ x: e.clientX, y: e.clientY, value: kfs[i].value })
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }, [selected, kfs, onBeginEdit, viewTickSpan, viewValueSpan, duration, valueTooltip])
  const handleKfContextMenu = useCallback((i: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selected.has(i)) setSelected(new Set([i]))
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [selected])

  const handleApplyPreset = useCallback((preset: EasePreset) => {
    commitCurve(applyEasePreset(kfs, selected, preset))
    setContextMenu(null)
  }, [commitCurve, kfs, selected])
  const handleHandlePointerDown = useCallback((i: number, side: 'L' | 'R') => (e: React.PointerEvent) => {
    e.stopPropagation()
    const kf = kfs[i]
    onBeginEdit()
    setDragState({
      type: side === 'L' ? 'handleL' : 'handleR',
      index: i,
      startX: e.clientX,
      startY: e.clientY,
      origins: new Map([[i, { tick: kf.tick, value: kf.value }]]),
      viewTickSpan,
      viewValueSpan,
      origHandleL: kf.handleL,
      origHandleR: kf.handleR,
    })
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }, [kfs, onBeginEdit, viewTickSpan, viewValueSpan])
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragState
    if (!d || !svgRef.current) return
    const dxPx = e.clientX - d.startX
    const dyPx = e.clientY - d.startY
    const rawTickDelta = d.lockTick ? 0 : Math.round(dxPx / plotW * d.viewTickSpan)
    const rawValueDelta = -dyPx / plotH * d.viewValueSpan

    if (d.type === 'kf') {
      const origins = Array.from(d.origins.values())
      const minTick = Math.min(...origins.map(origin => origin.tick))
      const maxTick = Math.max(...origins.map(origin => origin.tick))
      const minValue = Math.min(...origins.map(origin => origin.value))
      const maxValue = Math.max(...origins.map(origin => origin.value))
      const tickDelta = Math.max(-minTick, Math.min(rawTickDelta, duration - maxTick))
      const valueDelta = Math.max(valueMin - minValue, Math.min(rawValueDelta, valueMax - maxValue))
      const newKfs = kfs.map((kf, i) => {
        const origin = d.origins.get(i)
        return origin
          ? { ...kf, tick: origin.tick + tickDelta, value: snapValue(origin.value + valueDelta) }
          : kf
      })
      const draggedKeyframe = newKfs[d.index]
      if (valueTooltip && draggedKeyframe) {
        setDragTooltip({ x: e.clientX, y: e.clientY, value: draggedKeyframe.value })
      }
      const ticks = new Set(newKfs.map(kf => kf.tick))
      if (ticks.size !== newKfs.length) return
      onChange({ keyframes: newKfs })
      return
    }

    const newKfs = kfs.map((kf, i) => {
      if (i !== d.index) return kf
      if (d.type === 'handleL') {
        return {
          ...kf,
          handleL: {
            dt: (d.origHandleL?.dt ?? -DEFAULT_BEZIER_HANDLE) + rawTickDelta,
            dv: (d.origHandleL?.dv ?? 0) + rawValueDelta,
          },
        }
      }
      return {
        ...kf,
        handleR: {
          dt: (d.origHandleR?.dt ?? DEFAULT_BEZIER_HANDLE) + rawTickDelta,
          dv: (d.origHandleR?.dv ?? 0) + rawValueDelta,
        },
      }
    })
    onChange({ keyframes: newKfs })
  }, [
    dragState, kfs, plotW, plotH, duration, valueMax, valueMin, onChange, snapValue, valueTooltip,
  ])
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState) return
    if (dragState.type === 'kf') {
      const movedKeyframes = new Set(
        Array.from(dragState.origins.keys())
          .map(index => kfs[index])
          .filter((kf): kf is Keyframe => Boolean(kf)),
      )
      const sorted = [...kfs].sort((a, b) => a.tick - b.tick)
      if (commitCurve(sorted)) {
        setSelected(new Set(
          sorted
            .map((kf, index) => movedKeyframes.has(kf) ? index : -1)
            .filter(index => index >= 0),
        ))
      }
    }
    setDragState(null)
    setDragTooltip(null)
    onEndEdit()
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    }
    catch {
      // noop
    }
  }, [dragState, kfs, commitCurve, onEndEdit])
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [contextMenu])
  // キーボード操作: T = Linear/Bezier toggle, Delete = remove
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement !== svgRef.current) return
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
        e.stopImmediatePropagation()
        const newKfs = kfs.filter((_, i) => !selected.has(i))
        setSelected(new Set())
        commitCurve(newKfs)
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [selected, kfs, commitCurve])

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb="1">
        <Text fontSize="sm" color="gray.400">{label}</Text>
        {snapValues && (
          <Button size="xs" variant={snapEnabled ? 'solid' : 'outline'} onClick={() => setSnapEnabled(enabled => !enabled)}>
            <span>音階スナップ:</span>
            <span>{snapEnabled ? 'ON' : 'OFF'}</span>
          </Button>
        )}
      </Box>
      <svg
        ref={svgRef}
        tabIndex={0}
        width={width} height={height}
        style={{ background: '#111827', border: '1px solid #374151', borderRadius: 4, cursor: 'crosshair', userSelect: 'none', outline: 'none' }}
        onPointerDownCapture={() => svgRef.current?.focus()}
        onPointerDown={handleBgPointerDown}
        onDoubleClick={handleBgDoubleClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={e => e.preventDefault()}
      >
        {/* グリッド */}
        <line x1={tickToX(0)} y1={PAD.t} x2={tickToX(0)} y2={PAD.t + plotH} stroke="#374151" />
        <line x1={PAD.l} y1={valueToY(valueMin)} x2={PAD.l + plotW} y2={valueToY(valueMin)} stroke="#374151" />
        {referenceValue !== undefined && referenceValue >= viewport.valueMin && referenceValue <= viewport.valueMax && (
          <>
            <line x1={PAD.l} y1={valueToY(referenceValue)} x2={PAD.l + plotW} y2={valueToY(referenceValue)} stroke="#6b7280" strokeDasharray="4 3" />
            <text x={PAD.l - 4} y={valueToY(referenceValue) + 3} textAnchor="end" fill="#d1d5db" fontSize="10">{referenceValue.toFixed(2)}</text>
          </>
        )}
        {/* Y 軸ラベル */}
        <text x={PAD.l - 4} y={PAD.t + 4} textAnchor="end" fill="#9ca3af" fontSize="10">{viewport.valueMax.toFixed(2)}</text>
        <text x={PAD.l - 4} y={PAD.t + plotH} textAnchor="end" fill="#9ca3af" fontSize="10">{viewport.valueMin.toFixed(2)}</text>
        {/* X 軸ラベル */}
        <text x={tickToX(0)} y={height - 4} fill="#9ca3af" fontSize="10">0</text>
        <text x={tickToX(duration)} y={height - 4} textAnchor="end" fill="#9ca3af" fontSize="10">{duration}</text>
        {/* カーブ */}
        <path d={pathD} stroke="#3b82f6" strokeWidth={2} fill="none" pointerEvents="none" />
        {/* キーフレーム + ハンドル */}
        {kfs.map((kf, i) => {
          const cx = tickToX(kf.tick)
          const cy = valueToY(kf.value)
          const isSel = selected.has(i)
          const handleL = kf.handleL
          const handleR = kf.handleR
          return (
            <g key={i}>
              {kf.interpolation === 'bezier' && isSel && (
                <>
                  {handleL && (
                    <>
                      <line
                        x1={cx} y1={cy}
                        x2={tickToX(kf.tick + handleL.dt)} y2={valueToY(kf.value + handleL.dv)}
                        stroke="#f59e0b"
                      />
                      <circle
                        cx={tickToX(kf.tick + handleL.dt)} cy={valueToY(kf.value + handleL.dv)}
                        r={4} fill="#f59e0b" cursor="grab"
                        onPointerDown={handleHandlePointerDown(i, 'L')}
                        onDoubleClick={e => e.stopPropagation()}
                      />
                    </>
                  )}
                  {handleR && (
                    <>
                      <line
                        x1={cx} y1={cy}
                        x2={tickToX(kf.tick + handleR.dt)} y2={valueToY(kf.value + handleR.dv)}
                        stroke="#f59e0b"
                      />
                      <circle
                        cx={tickToX(kf.tick + handleR.dt)} cy={valueToY(kf.value + handleR.dv)}
                        r={4} fill="#f59e0b" cursor="grab"
                        onPointerDown={handleHandlePointerDown(i, 'R')}
                        onDoubleClick={e => e.stopPropagation()}
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
                onDoubleClick={e => e.stopPropagation()}
                onContextMenu={handleKfContextMenu(i)}
              />
            </g>
          )
        })}
      </svg>
      {contextMenu && (
        <Box
          position="fixed"
          left={`${contextMenu.x}px`}
          top={`${contextMenu.y}px`}
          zIndex={2000}
          minW="140px"
          p="1"
          bg="gray.800"
          border="1px solid"
          borderColor="gray.600"
          borderRadius="md"
          boxShadow="lg"
          onPointerDown={e => e.stopPropagation()}
        >
          <Button size="xs" variant="ghost" w="full" justifyContent="flex-start" onClick={() => handleApplyPreset('ease-in')}>
            Ease In
          </Button>
          <Button size="xs" variant="ghost" w="full" justifyContent="flex-start" onClick={() => handleApplyPreset('ease-out')}>
            Ease Out
          </Button>
          <Button size="xs" variant="ghost" w="full" justifyContent="flex-start" onClick={() => handleApplyPreset('ease-in-out')}>
            Ease InOut
          </Button>
        </Box>
      )}
      {dragTooltip && (
        <Box
          position="fixed"
          left={`${dragTooltip.x + 12}px`}
          top={`${dragTooltip.y + 12}px`}
          zIndex={2100}
          px="2"
          py="1"
          bg="gray.800"
          border="1px solid"
          borderColor="gray.600"
          borderRadius="sm"
          fontSize="xs"
          pointerEvents="none"
        >
          {dragTooltipText}
        </Box>
      )}
      <Text fontSize="xs" color="gray.500" mt="1">
        ダブルクリックで追加 / ドラッグで移動 / 右クリックで Ease / T で Linear⇔Bezier / Delete で削除
      </Text>
    </Box>
  )
}
