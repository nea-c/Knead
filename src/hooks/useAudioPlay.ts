import { useCallback, useState, useMemo, useEffect } from 'react'
import { mapEntries } from '../utils/ObjectUtil'

type GlobalContext = {
  isSomePlaying: boolean
}

type PlayingContext = {
  isPlaying: true
  absn: AudioBufferSourceNode
  gc: GainNode
}
type StoppingContext = {
  isPlaying: false
}

type Context = (PlayingContext | StoppingContext) & {
  /** 再生時間 */
  playbackTime: number
  /** 最大再生時間 */
  maxTime: number
  /** 音量 */
  volume: number
  /** 再生速度 */
  speed: number
  /** 音声データ */
  buffer: AudioBuffer
  /** 再生開始時刻 */
  playTime: number
}

type PublicContext = Pick<Context, 'isPlaying' | 'playbackTime' | 'maxTime' | 'volume' | 'speed'>

type Commands = {
  play: () => void
  pause: () => void
  stop: () => void

  setSound: (soundKey: string, uri: string, speed?: number, volume?: number) => Promise<void>
  setSounds: (sounds: { [k: string]: string | [uri: string, speed?: number, volume?: number] }) => Promise<void>
  setVolume: (soundKey: string, volume: number) => void
  setSpeed: (soundKey: string, speed: number) => void
  setPlaybackTime: (soundKey: string, playbackTime: number) => void
}

type AudioState = { [k: string]: Context }
/**
 * @description
 *  各ステートに対する操作について
 *  - 再生中
 *    - play: 何もしない
 *    - pause: 一時停止
 *    - stop: 停止
 *  - 一時停止中
 *    - play: 再生
 *    - pause: 何もしない
 *    - stop: 停止
 *  - 停止中
 *    - play: 再生
 *    - pause: 何もしない
 *    - stop: 何もしない
 */
export const useAudioPlay = (): { context: GlobalContext, contexts: { head?: PublicContext } & { [k: string]: PublicContext }, commands: Commands } => {
  const audioContext = useMemo(() => new AudioContext(), [])

  const [audioState, setAudioState] = useState<AudioState>({})

  // MARK: playingWatcher
  const [playingWatcher, setPlayingWatcher] = useState<NodeJS.Timeout>()
  const syncAudioContext = useCallback(() => {
    setAudioState(prev => mapEntries(prev, (ctx) => {
      if (ctx.isPlaying) {
        return { ...ctx, playbackTime: (ctx.absn.context.currentTime - ctx.playTime) * ctx.speed }
      }
      return ctx
    }))
  }, [setAudioState])
  useEffect(() => {
    if (playingWatcher || Object.values(audioState).every(ctx => !ctx.isPlaying)) return
    const watcher = setInterval(syncAudioContext, 5)
    setPlayingWatcher(watcher)
  }, [audioState, playingWatcher, syncAudioContext])
  useEffect(() => {
    if (playingWatcher && Object.values(audioState).every(ctx => !ctx.isPlaying)) {
      clearInterval(playingWatcher)
      setPlayingWatcher(undefined)
    }
  }, [audioState, playingWatcher, setPlayingWatcher])

  // MARK: createAudioContext
  const createAudioContext = useCallback((buffer: AudioBuffer, speed: number, volume: number): [AudioBufferSourceNode, GainNode] => {
    const absn = audioContext.createBufferSource()
    absn.buffer = buffer
    absn.playbackRate.value = speed
    absn.connect(audioContext.destination)

    const gainController = audioContext.createGain()
    gainController.connect(audioContext.destination)
    absn.connect(gainController)
    gainController.gain.value = volume

    return [absn, gainController]
  }, [audioContext])

  // MARK: play
  const play = useCallback(() => {
    setAudioState(prev => mapEntries(prev, (ctx, k) => {
      if (ctx.isPlaying) return ctx

      const [absn, gc] = createAudioContext(ctx.buffer, ctx.speed, ctx.volume)
      const playOffset = ctx.playbackTime !== ctx.maxTime ? ctx.playbackTime : 0
      absn.start(0, playOffset)
      absn.onended = () => setAudioState(prev2 => ({ ...prev2, [k]: { ...prev2[k], isPlaying: false, playbackTime: ctx.maxTime } }))
      const playTime = absn.context.currentTime - playOffset / ctx.speed
      return { ...ctx, isPlaying: true, absn, gc, playTime }
    }))
  }, [createAudioContext])

  // MARK: pause
  const pause = useCallback(() => {
    setAudioState(prev => mapEntries(prev, (ctx) => {
      if (!ctx.isPlaying) return ctx

      console.log('pause', ctx)
      ctx.absn.onended = null
      ctx.absn.stop()
      return { ...ctx, isPlaying: false, playTime: 0 }
    }))
  }, [])

  // MARK: stop
  const stop = useCallback(async () => {
    return new Promise<void>((resolve) => {
      setAudioState((prev) => {
        const newState = { ...prev }
        // すべてのコンテキストを停止状態にリセット
        Object.entries(prev).forEach(([key, ctx]) => {
          if ('isPlaying' in ctx && ctx.isPlaying) {
            try {
              ctx.absn.onended = null
              ctx.absn.stop()
            }
            catch (e) {
              console.error('Error stopping audio:', e)
            }
          }
          // 再生状態に関わらず全てのサウンドを停止状態にする
          newState[key] = {
            ...ctx,
            isPlaying: false as const,
            playbackTime: 0,
            playTime: 0,
          }
        })

        resolve()
        return newState
      })
    })
  }, [setAudioState])

  // MARK: createAudioBuffer
  const createAudioBuffer = useCallback(async (uri: string): Promise<AudioBuffer> => {
    const res = await fetch(uri)
    const buffer = await res.arrayBuffer()
    return await audioContext.decodeAudioData(buffer)
  }, [audioContext])

  // MARK: createContext
  const createContext = useCallback((ctx: Pick<Context, 'maxTime' | 'buffer'> & Partial<Omit<Context, 'isPlaying'>>): Context => ({
    isPlaying: false,
    playbackTime: 0,
    volume: 1,
    speed: 1,
    playTime: 0,
    ...ctx,
  }), [])

  // MARK: setSound
  const setSound = useCallback(async (soundKey: string, uri: string, speed: number = 1, volume: number = 1) => {
    try {
      // 同期的に確実に停止する
      await stop()

      // 少し待機して AudioContext の処理を完了させる
      await new Promise(resolve => setTimeout(resolve, 50))

      // 現在のstateを一度クリアしてから新しいサウンドを設定
      setAudioState({})
      await new Promise(resolve => setTimeout(resolve, 50))

      const buffer = await createAudioBuffer(uri)
      setAudioState({ [soundKey]: createContext({ buffer, maxTime: buffer.duration, volume, speed }) })
    }
    catch (e) {
      console.error('Error setting sound:', e)
      throw e
    }
  }, [createAudioBuffer, createContext, stop])

  // MARK: setSounds
  const setSounds = useCallback(async (sounds: { [k: string]: string | [uri: string, speed?: number, volume?: number] }) => {
    stop()
    const audioContexts = await Promise.all(Object.entries(sounds).map(async ([k, v]) => {
      const [uri, speed, volume] = Array.isArray(v) ? v : [v]
      const buffer = await createAudioBuffer(uri)
      return [k, createContext({ buffer, maxTime: buffer.duration, volume, speed })]
    }))
    setAudioState(Object.fromEntries(audioContexts))
  }, [createAudioBuffer, createContext, stop])

  // MARK: setVolume
  const setVolume = useCallback((soundKey: string, volume: number) => {
    setAudioState((prev) => {
      if (prev[soundKey].isPlaying) {
        prev[soundKey].gc.gain.value = volume
      }
      return { ...prev, [soundKey]: { ...prev[soundKey], volume } }
    })
  }, [])

  // MARK: setSpeed
  const setSpeed = useCallback((soundKey: string, speed: number) => {
    setAudioState((prev) => {
      if (!prev[soundKey].isPlaying) return { ...prev, [soundKey]: { ...prev[soundKey], speed } }

      prev[soundKey].absn.playbackRate.value = speed

      const time = prev[soundKey].absn.context.currentTime
      const playTime = time - prev[soundKey].playbackTime / speed
      return { ...prev, [soundKey]: { ...prev[soundKey], speed, playTime } }
    })
  }, [])

  // MARK: setPlaybackTime
  const setPlaybackTime = useCallback((soundKey: string, playbackTime: number) => {
    if (audioState[soundKey].isPlaying) {
      pause()
    }
    setAudioState(prev => ({ ...prev, [soundKey]: { ...prev[soundKey], playbackTime } }))
    if (audioState[soundKey].isPlaying) {
      play()
    }
  }, [audioState, pause, play])

  const globalContext = useMemo(() => ({ isSomePlaying: Object.values(audioState).some(ctx => ctx.isPlaying) }), [audioState])

  const contexts = useMemo(() => {
    const head = audioState[Object.keys(audioState)[0]]
    return { head, ...audioState }
  }, [audioState])

  const commands = useMemo(
    () => ({ play, pause, stop, setSound, setSounds, setVolume, setSpeed, setPlaybackTime }),
    [play, pause, stop, setSound, setSounds, setVolume, setSpeed, setPlaybackTime],
  )

  return { context: globalContext, contexts, commands }
}
