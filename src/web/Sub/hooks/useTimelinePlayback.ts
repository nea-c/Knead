import { useCallback, useEffect, useRef, useState } from 'react'
import type { Marker } from '../types/timeline'
import type { useAudioBufferCache } from './useAudioBufferCache'

const TICK_SEC = 0.05  // 1 tick = 50ms

interface Params {
  markers: Marker[]
  lengthTicks: number
  cache: ReturnType<typeof useAudioBufferCache>
}

export function useTimelinePlayback({ markers, lengthTicks, cache }: Params) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTick, setCurrentTick] = useState(0)

  // 再生中に参照するミュータブル状態
  const playStartAudioTimeRef = useRef<number>(0)  // AudioContext 上の再生開始時刻
  const startTickRef = useRef<number>(0)            // 再生開始時の tick
  const scheduledIdsRef = useRef<Set<string>>(new Set())  // すでにスケジュール済みマーカー id
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const rafRef = useRef<number | null>(null)
  // 再生中に markers / lengthTicks が更新されても rAF ループから最新値を参照できるよう ref に反映
  const markersRef = useRef(markers)
  const lengthTicksRef = useRef(lengthTicks)
  useEffect(() => { markersRef.current = markers }, [markers])
  useEffect(() => { lengthTicksRef.current = lengthTicks }, [lengthTicks])
  // 同期的な多重 play() 防止（state は非同期更新のため）
  const playingRef = useRef(false)

  const scheduleMarker = useCallback((m: Marker) => {
    const buf = cache.getBuffer(m.soundId, m.variantIndex)
    if (!buf) return
    const ctx = cache.getAudioContext()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = m.pitch
    const gain = ctx.createGain()
    gain.gain.value = m.volume
    src.connect(gain).connect(ctx.destination)
    const when = playStartAudioTimeRef.current + (m.tick - startTickRef.current) * TICK_SEC
    const safeWhen = Math.max(when, ctx.currentTime)
    src.start(safeWhen)
    activeSourcesRef.current.push(src)
    src.onended = () => {
      const idx = activeSourcesRef.current.indexOf(src)
      if (idx >= 0) activeSourcesRef.current.splice(idx, 1)
    }
  }, [cache])

  const stopAllSources = useCallback(() => {
    for (const s of activeSourcesRef.current) {
      try { s.stop() }
      catch { /* すでに停止済み */ }
      try { s.disconnect() }
      catch { /* noop */ }
    }
    activeSourcesRef.current = []
    scheduledIdsRef.current.clear()
  }, [])

  const stopInternal = useCallback(() => {
    playingRef.current = false
    stopAllSources()
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsPlaying(false)
  }, [stopAllSources])

  const tick = useCallback(() => {
    const ctx = cache.getAudioContext()
    const elapsedSec = ctx.currentTime - playStartAudioTimeRef.current
    const cur = startTickRef.current + elapsedSec / TICK_SEC
    const len = lengthTicksRef.current

    // 末尾到達で自動停止（表示上は末尾でクランプ）
    if (cur >= len) {
      setCurrentTick(len)
      stopInternal()
      return
    }
    setCurrentTick(cur)

    // 先読み: 現在時刻 + 100ms 内のマーカーを未スケジュール分だけ登録
    const lookaheadTick = cur + 0.1 / TICK_SEC
    for (const m of markersRef.current) {
      if (scheduledIdsRef.current.has(m.id)) continue
      if (m.tick < startTickRef.current) continue
      if (m.tick > lookaheadTick) continue
      scheduleMarker(m)
      scheduledIdsRef.current.add(m.id)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [scheduleMarker, cache, stopInternal])

  const play = useCallback(() => {
    if (playingRef.current) return
    playingRef.current = true
    const ctx = cache.getAudioContext()
    // ユーザー操作起点の resume（AudioContext は最初は suspended）
    ctx.resume().catch(() => {})
    // 末尾に到達済みなら 0 に巻き戻してから再生
    const startFrom = currentTick >= lengthTicksRef.current ? 0 : currentTick
    playStartAudioTimeRef.current = ctx.currentTime
    startTickRef.current = startFrom
    setCurrentTick(startFrom)
    scheduledIdsRef.current.clear()
    setIsPlaying(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [cache, currentTick, tick])

  const stop = useCallback(() => {
    stopInternal()
    setCurrentTick(0)
  }, [stopInternal])

  const seek = useCallback((newTick: number) => {
    const wasPlaying = playingRef.current
    const clamped = Math.max(0, Math.min(lengthTicksRef.current, newTick))
    stopInternal()
    setCurrentTick(clamped)
    if (wasPlaying) {
      playingRef.current = true
      const ctx = cache.getAudioContext()
      playStartAudioTimeRef.current = ctx.currentTime
      startTickRef.current = clamped
      scheduledIdsRef.current.clear()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [stopInternal, cache, tick])

  // アンマウント時掃除
  useEffect(() => {
    return () => stopInternal()
  }, [stopInternal])

  return { isPlaying, currentTick, play, stop, seek }
}
