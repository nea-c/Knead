import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Marker } from '../types/timeline'
import type { useAudioBufferCache } from './useAudioBufferCache'
import { sampleCurve } from '../utils/curveSampling'

const TICK_SEC = 0.05 // 1 tick = 50ms

interface Params {
  markers: Marker[]
  lengthTicks: number
  cache: ReturnType<typeof useAudioBufferCache>
  masterVolume: number
}

interface Firing {
  key: string        // marker.id#i
  soundId: string
  variantIndex: number
  tick: number       // absolute timeline tick
  volume: number
  pitch: number
}

function enumerateFirings(m: Marker): Firing[] {
  const dur = m.duration ?? 0
  if (dur <= 0) {
    return [{
      key: `${m.id}#0`,
      soundId: m.soundId,
      variantIndex: m.variantIndex,
      tick: m.tick,
      volume: m.volume,
      pitch: m.pitch,
    }]
  }
  const interval = m.retriggerInterval && m.retriggerInterval > 0 ? m.retriggerInterval : 5
  const firings: Firing[] = []
  for (let i = 0; i * interval <= dur; i++) {
    const offset = i * interval
    firings.push({
      key: `${m.id}#${i}`,
      soundId: m.soundId,
      variantIndex: m.variantIndex,
      tick: m.tick + offset,
      volume: sampleCurve(m.volumeCurve, offset, m.volume),
      pitch: sampleCurve(m.pitchCurve, offset, m.pitch),
    })
  }
  return firings
}

export function useTimelinePlayback({ markers, lengthTicks, cache, masterVolume }: Params) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTick, setCurrentTick] = useState(0)

  const playStartAudioTimeRef = useRef<number>(0)
  const startTickRef = useRef<number>(0)
  const scheduledKeysRef = useRef<Set<string>>(new Set())
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const rafRef = useRef<number | null>(null)
  const markersRef = useRef(markers)
  const lengthTicksRef = useRef(lengthTicks)
  useEffect(() => { markersRef.current = markers }, [markers])
  useEffect(() => { lengthTicksRef.current = lengthTicks }, [lengthTicks])
  const playingRef = useRef(false)
  const pausedRef = useRef(false)
  const [isPaused, setIsPaused] = useState(false)

  const cacheRef = useRef(cache)
  useEffect(() => { cacheRef.current = cache }, [cache])

  // サブウィンドウ独自のマスターボリューム。
  // 再生中の変更を反映するため単一の GainNode を経由させる。
  const masterGainRef = useRef<GainNode | null>(null)
  const ensureMasterGain = useCallback((): GainNode => {
    const ctx = cacheRef.current.getAudioContext()
    if (!masterGainRef.current || (masterGainRef.current as unknown as { context: BaseAudioContext }).context !== ctx) {
      const g = ctx.createGain()
      g.gain.value = masterVolume
      g.connect(ctx.destination)
      masterGainRef.current = g
    }
    return masterGainRef.current!
  }, [masterVolume])
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterVolume
    }
  }, [masterVolume])

  const scheduleFiring = useCallback((f: Firing): boolean => {
    const buf = cacheRef.current.getBuffer(f.soundId, f.variantIndex)
    if (!buf) return false
    const ctx = cacheRef.current.getAudioContext()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = f.pitch
    const gain = ctx.createGain()
    gain.gain.value = f.volume
    src.connect(gain).connect(ensureMasterGain())
    const when = playStartAudioTimeRef.current + (f.tick - startTickRef.current) * TICK_SEC
    const safeWhen = Math.max(when, ctx.currentTime)
    src.start(safeWhen)
    activeSourcesRef.current.push(src)
    src.onended = () => {
      const idx = activeSourcesRef.current.indexOf(src)
      if (idx >= 0) activeSourcesRef.current.splice(idx, 1)
    }
    return true
  }, [])

  const stopAllSources = useCallback(() => {
    for (const s of activeSourcesRef.current) {
      try { s.stop() }
      catch { /* noop */ }
      try { s.disconnect() }
      catch { /* noop */ }
    }
    activeSourcesRef.current = []
    scheduledKeysRef.current.clear()
  }, [])

  const stopInternal = useCallback(() => {
    playingRef.current = false
    pausedRef.current = false
    stopAllSources()
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsPlaying(false)
    setIsPaused(false)
  }, [stopAllSources])

  const tick = useCallback(() => {
    const ctx = cacheRef.current.getAudioContext()
    const elapsedSec = ctx.currentTime - playStartAudioTimeRef.current
    const cur = startTickRef.current + elapsedSec / TICK_SEC
    const len = lengthTicksRef.current

    if (cur >= len) {
      setCurrentTick(len)
      stopInternal()
      return
    }
    setCurrentTick(cur)

    const lookaheadTick = cur + 0.1 / TICK_SEC
    for (const m of markersRef.current) {
      const firings = enumerateFirings(m)
      for (const f of firings) {
        if (scheduledKeysRef.current.has(f.key)) continue
        if (f.tick < startTickRef.current) continue
        if (f.tick > lookaheadTick) continue
        const started = scheduleFiring(f)
        if (started) scheduledKeysRef.current.add(f.key)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [scheduleFiring, stopInternal])

  const play = useCallback(() => {
    if (playingRef.current) return
    playingRef.current = true
    const ctx = cacheRef.current.getAudioContext()
    ctx.resume().catch(() => {})
    const startFrom = currentTick >= lengthTicksRef.current ? 0 : currentTick
    playStartAudioTimeRef.current = ctx.currentTime
    startTickRef.current = startFrom
    setCurrentTick(startFrom)
    scheduledKeysRef.current.clear()
    setIsPlaying(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [currentTick, tick])

  const stop = useCallback(() => {
    stopInternal()
    setCurrentTick(0)
  }, [stopInternal])

  const pause = useCallback(() => {
    if (!playingRef.current || pausedRef.current) return
    pausedRef.current = true
    const ctx = cacheRef.current.getAudioContext()
    ctx.suspend().catch(() => {})
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsPlaying(false)
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    if (!pausedRef.current) return
    pausedRef.current = false
    const ctx = cacheRef.current.getAudioContext()
    ctx.resume().catch(() => {})
    setIsPlaying(true)
    setIsPaused(false)
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const seek = useCallback((newTick: number) => {
    const wasPlaying = playingRef.current
    const clamped = Math.max(0, Math.min(lengthTicksRef.current, newTick))
    stopInternal()
    setCurrentTick(clamped)
    if (wasPlaying) {
      playingRef.current = true
      const ctx = cacheRef.current.getAudioContext()
      ctx.resume().catch(() => {})
      playStartAudioTimeRef.current = ctx.currentTime
      startTickRef.current = clamped
      scheduledKeysRef.current.clear()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [stopInternal, tick])

  useEffect(() => {
    return () => stopInternal()
  }, [stopInternal])

  return useMemo(
    () => ({ isPlaying, isPaused, currentTick, play, stop, pause, resume, seek }),
    [isPlaying, isPaused, currentTick, play, stop, pause, resume, seek],
  )
}
