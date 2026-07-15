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

  const tick = useCallback(() => {
    const ctx = cache.getAudioContext()
    const elapsedSec = ctx.currentTime - playStartAudioTimeRef.current
    const cur = startTickRef.current + elapsedSec / TICK_SEC
    setCurrentTick(cur)

    // 先読み: 現在時刻 + 100ms 内のマーカーを未スケジュール分だけ登録
    const lookaheadTick = cur + 0.1 / TICK_SEC
    for (const m of markers) {
      if (scheduledIdsRef.current.has(m.id)) continue
      if (m.tick < startTickRef.current) continue
      if (m.tick > lookaheadTick) continue
      scheduleMarker(m)
      scheduledIdsRef.current.add(m.id)
    }

    // 末尾到達で自動停止
    if (cur >= lengthTicks) {
      stopInternal()
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [markers, lengthTicks, scheduleMarker, cache])

  const stopInternal = useCallback(() => {
    stopAllSources()
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsPlaying(false)
  }, [stopAllSources])

  const play = useCallback(() => {
    if (isPlaying) return
    const ctx = cache.getAudioContext()
    // ユーザー操作起点の resume（AudioContext は最初は suspended）
    ctx.resume().catch(() => {})
    playStartAudioTimeRef.current = ctx.currentTime
    startTickRef.current = currentTick
    scheduledIdsRef.current.clear()
    setIsPlaying(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [isPlaying, cache, currentTick, tick])

  const stop = useCallback(() => {
    stopInternal()
    setCurrentTick(0)
  }, [stopInternal])

  const seek = useCallback((newTick: number) => {
    const wasPlaying = isPlaying
    stopInternal()
    setCurrentTick(Math.max(0, Math.min(lengthTicks, newTick)))
    if (wasPlaying) {
      // stopInternal 後に再度 play する必要があるが、currentTick が state 更新なので
      // 次レンダーで新しい tick から再開させるフラグを立てる方式ではなく、直接再開:
      const ctx = cache.getAudioContext()
      playStartAudioTimeRef.current = ctx.currentTime
      startTickRef.current = Math.max(0, Math.min(lengthTicks, newTick))
      scheduledIdsRef.current.clear()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [isPlaying, stopInternal, lengthTicks, cache, tick])

  // アンマウント時掃除
  useEffect(() => {
    return () => stopInternal()
  }, [stopInternal])

  return { isPlaying, currentTick, play, stop, seek }
}
