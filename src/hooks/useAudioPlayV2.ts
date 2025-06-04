import { useRef, useState, useEffect, useCallback } from 'react'

export interface AudioControls {
  play: () => void
  stop: () => void
  pause: () => void
  resume: () => void
  setVolume: (v: number) => void
  setPitch: (p: number) => void
  isPlaying: boolean
  isPaused: boolean
  isFinished: boolean
  resetAndPlay: () => void
  forceReloadAndPlay: () => void
}

/**
 * audioPath が変わるたびにAudio要素を再生成
 * 再生・停止・音量・ピッチを制御
 */
export function useAudioPlay(
  audioPath: string | null,
  initialVolume: number = 1.0,
  initialPitch: number = 1.0,
  pauseTime: number,
  setPauseTime: (t: number) => void,
): AudioControls {
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const startTimeRef = useRef<number>(0)
  const [currentPitch, setCurrentPitch] = useState(initialPitch)
  const [currentVolume, setCurrentVolume] = useState(initialVolume)

  // AudioContextの初期化
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    if (!gainNodeRef.current) {
      gainNodeRef.current = audioContextRef.current.createGain()
      gainNodeRef.current.connect(audioContextRef.current.destination)
    }
  }, [])

  // 音声データの読み込み
  const loadAudio = useCallback(async (path: string) => {
    if (!audioContextRef.current) return

    try {
      const response = await fetch(path)
      const arrayBuffer = await response.arrayBuffer()
      audioBufferRef.current = await audioContextRef.current.decodeAudioData(arrayBuffer)
    }
    catch (error) {
      console.error('Error loading audio:', error)
    }
  }, [])

  // パス変更時 or アンマウント時のクリーンアップ
  useEffect(() => {
    const cleanup = async () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop()
        sourceNodeRef.current.disconnect()
        sourceNodeRef.current = null
      }
      setIsPlaying(false)
      setIsFinished(false)
      startTimeRef.current = 0
      if (!audioPath) {
        setPauseTime(0)
      }
      if (audioPath) {
        initAudioContext()
        await loadAudio(audioPath)
      }
    }

    cleanup()
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [audioPath, initAudioContext, loadAudio, setPauseTime])

  const play = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current) return

    // 既存のソースを停止
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop()
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }

    // 既存のgainNodeをクリーンアップ
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect()
      gainNodeRef.current = null
    }

    // 新しいgainNodeを作成
    gainNodeRef.current = audioContextRef.current.createGain()
    gainNodeRef.current.gain.value = currentVolume
    gainNodeRef.current.connect(audioContextRef.current.destination)

    // 新しいソースを作成
    const source = audioContextRef.current.createBufferSource()
    source.buffer = audioBufferRef.current
    source.playbackRate.value = currentPitch
    source.connect(gainNodeRef.current)
    sourceNodeRef.current = source

    // 再生開始（最初から）
    const offset = 0
    setPauseTime(0) // play時のみリセット
    startTimeRef.current = audioContextRef.current.currentTime
    source.start(0, offset)
    source.onended = () => {
      if (sourceNodeRef.current === source) {
        setIsPlaying(false)
        setIsFinished(true)
        setPauseTime(0)
      }
    }

    setIsPlaying(true)
    setIsPaused(false)
    setIsFinished(false)
  }, [currentPitch, currentVolume, setPauseTime])

  const stop = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop()
        sourceNodeRef.current.disconnect()
        sourceNodeRef.current = null
      }
      setIsPlaying(false)
      setIsPaused(false)
      setIsFinished(false)
      startTimeRef.current = 0
      setPauseTime(0)
      setTimeout(resolve, 20)
    })
  }, [setPauseTime])

  const pause = useCallback(() => {
    if (!audioContextRef.current || !sourceNodeRef.current) return
    const t = audioContextRef.current.currentTime - startTimeRef.current
    setPauseTime(t)
    sourceNodeRef.current.disconnect()
    sourceNodeRef.current = null
    setIsPlaying(false)
    setIsPaused(true)
  }, [setPauseTime])

  const resume = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current) return

    // 既存のソースを停止
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop()
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }

    // 既存のgainNodeをクリーンアップ
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect()
      gainNodeRef.current = null
    }

    // 新しいgainNodeを作成
    gainNodeRef.current = audioContextRef.current.createGain()
    gainNodeRef.current.gain.value = currentVolume
    gainNodeRef.current.connect(audioContextRef.current.destination)

    // 新しいソースを作成
    const source = audioContextRef.current.createBufferSource()
    source.buffer = audioBufferRef.current
    source.playbackRate.value = currentPitch
    source.connect(gainNodeRef.current)
    sourceNodeRef.current = source

    // 再生開始（一時停止位置から）
    const offset = pauseTime
    startTimeRef.current = audioContextRef.current.currentTime - offset
    source.start(0, offset)
    source.onended = () => {
      if (sourceNodeRef.current === source) {
        setIsPlaying(false)
        setIsFinished(true)
        setPauseTime(0)
      }
    }

    setIsPlaying(true)
    setIsPaused(false)
    setIsFinished(false)
  }, [currentPitch, currentVolume, pauseTime, setPauseTime])

  const setVolume = useCallback((v: number) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = v
      setCurrentVolume(v)
    }
  }, [])

  const setPitch = useCallback((p: number) => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.playbackRate.value = p
    }
    setCurrentPitch(p)
  }, [])

  const resetAndPlay = useCallback(() => {
    stop().then(() => {
      setPauseTime(0)
      play()
    })
  }, [play, stop, setPauseTime])

  const forceReloadAndPlay = useCallback(async () => {
    if (!audioPath) return

    await stop()
    await loadAudio(audioPath)
    setPauseTime(0)
    play()
  }, [audioPath, loadAudio, play, stop, setPauseTime])

  return { play, stop, pause, resume, setVolume, setPitch, isPlaying, isPaused, isFinished, resetAndPlay, forceReloadAndPlay }
}
