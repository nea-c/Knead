import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAudioLibrary } from '../../../hooks/useAudioLibrary'

export function useAudioBufferCache() {
  const { soundMap } = useAudioLibrary()
  const ctxRef = useRef<AudioContext | null>(null)
  // key = `${soundId}#${variantIndex}` (variantIndex は 0-based のみキャッシュ)
  const cacheRef = useRef<Map<string, AudioBuffer>>(new Map())

  const getAudioContext = useCallback((): AudioContext => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }, [])

  const loadOne = useCallback(async (soundId: string, variantIndex: number): Promise<void> => {
    const variants = soundMap[soundId]
    if (!variants || !variants[variantIndex]) return
    const key = `${soundId}#${variantIndex}`
    if (cacheRef.current.has(key)) return
    const hash = variants[variantIndex].hash
    if (!hash) return
    const absPath = await window.myAPI.get_mcSoundHash(hash)
    if (!absPath) return
    const res = await fetch('file://' + absPath)
    const arr = await res.arrayBuffer()
    const buf = await getAudioContext().decodeAudioData(arr)
    cacheRef.current.set(key, buf)
  }, [soundMap, getAudioContext])

  const preload = useCallback(async (soundIds: string[]): Promise<void> => {
    const jobs: Promise<void>[] = []
    for (const id of soundIds) {
      const variants = soundMap[id] || []
      for (let i = 0; i < variants.length; i++) jobs.push(loadOne(id, i))
    }
    await Promise.all(jobs)
  }, [soundMap, loadOne])

  const getBuffer = useCallback((soundId: string, variantIndex: number): AudioBuffer | undefined => {
    const variants = soundMap[soundId] || []
    if (variants.length === 0) return undefined
    const idx = variantIndex === -1
      ? Math.floor(Math.random() * variants.length)
      : variantIndex
    return cacheRef.current.get(`${soundId}#${idx}`)
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
    () => ({ preload, getBuffer, getAudioContext, clear }),
    [preload, getBuffer, getAudioContext, clear],
  )
}
