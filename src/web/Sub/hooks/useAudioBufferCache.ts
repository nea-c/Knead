import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAudioLibrary } from '../../../hooks/useAudioLibrary'

export function useAudioBufferCache() {
  const { soundMap } = useAudioLibrary()
  const ctxRef = useRef<AudioContext | null>(null)
  // key = variant の hash（設計仕様どおり。同じ hash を共有する variant はデコード済みバッファを共有する) (M10)
  const cacheRef = useRef<Map<string, AudioBuffer>>(new Map())
  // 同時に走っている preload() の数。0 になったら preloading を false に戻す (I8)
  const preloadCountRef = useRef(0)
  const [preloading, setPreloading] = useState(false)

  const getAudioContext = useCallback((): AudioContext => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }, [])

  const loadOne = useCallback(async (soundId: string, variantIndex: number): Promise<void> => {
    const variants = soundMap[soundId]
    if (!variants || !variants[variantIndex]) return
    const hash = variants[variantIndex].hash
    if (!hash) return
    if (cacheRef.current.has(hash)) return
    const absPath = await window.myAPI.get_mcSoundHash(hash)
    if (!absPath) return
    const res = await fetch('file://' + absPath)
    const arr = await res.arrayBuffer()
    const buf = await getAudioContext().decodeAudioData(arr)
    cacheRef.current.set(hash, buf)
  }, [soundMap, getAudioContext])

  const preload = useCallback(async (soundIds: string[]): Promise<void> => {
    const jobs: Promise<void>[] = []
    for (const id of soundIds) {
      const variants = soundMap[id] || []
      for (let i = 0; i < variants.length; i++) jobs.push(loadOne(id, i))
    }
    if (jobs.length === 0) return
    preloadCountRef.current += 1
    setPreloading(true)
    try {
      await Promise.all(jobs)
    }
    finally {
      preloadCountRef.current = Math.max(0, preloadCountRef.current - 1)
      if (preloadCountRef.current === 0) setPreloading(false)
    }
  }, [soundMap, loadOne])

  const getBuffer = useCallback((soundId: string, variantIndex: number): AudioBuffer | undefined => {
    const variants = soundMap[soundId] || []
    if (variants.length === 0) return undefined
    const idx = variantIndex === -1
      ? Math.floor(Math.random() * variants.length)
      : variantIndex
    const hash = variants[idx]?.hash
    if (!hash) return undefined
    return cacheRef.current.get(hash)
  }, [soundMap])

  const clear = useCallback(() => {
    cacheRef.current.clear()
  }, [])

  // アンマウント時に AudioContext を閉じる
  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {})
        ctxRef.current = null
      }
      cacheRef.current.clear()
    }
  }, [])

  return useMemo(
    () => ({ preload, getBuffer, getAudioContext, clear, preloading }),
    [preload, getBuffer, getAudioContext, clear, preloading],
  )
}
