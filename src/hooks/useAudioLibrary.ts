import { useMemo } from 'react'
import { useAppSelector } from '../store/_store'
import type { Sound } from '../store/fetchSlice'

export function useAudioLibrary() {
  const sounds = useAppSelector(state => state.fetch.sounds)
  const soundIdList = useMemo(() => sounds.map(s => s.id), [sounds])

  // ID → variant用配列のmap
  const soundMap = useMemo(() => {
    const m: Record<string, { path: string, hash: string }[]> = {}
    for (const s of sounds) {
      m[s.id] = s.sounds.map(ss => ({ path: ss.path, hash: ss.hash }))
    }
    return m
  }, [sounds])

  return { soundIdList, soundMap, loaded: sounds.length > 0 }
}
