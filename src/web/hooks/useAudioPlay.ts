import { useCallback, useState, useMemo } from 'react'
import { mapEntries } from '../../utils/ObjectUtil'

type Context = {
  isPlaying: boolean
  isPaused?: boolean
  playTime: number
  maxTime: number
  volume: number
  speed: number
}

type Commands = {
  play: () => void
  pause: () => void
  stop: () => void

  setSound: (soundKey: string, uri: string, speed?: number, volume?: number) => Promise<void>
  setSounds: (sounds: { [k: string]: string | [uri: string, speed?: number, volume?: number] }) => Promise<void>
  setVolume: (soundKey: string, volume: number) => void
  setSpeed: (soundKey: string, speed: number) => void
  setPlayTime: (soundKey: string, playTime: number) => void
}

type AudioState = { [k: string]: { absn: AudioBufferSourceNode, gc: GainNode, ctx: Context } }
export const useAudioPlay = (): { contexts: { [k: string]: Context }, commands: Commands } => {
  const audioContext = useMemo(() => new AudioContext(), [])

  const [audioState, setAudioState] = useState<AudioState>({})

  // MARK: playingWatcher
  const [playingWatcher, setPlayingWatcher] = useState<NodeJS.Timeout>()
  const syncAudioContext = useCallback(() => {
    setAudioState(prev => mapEntries(prev, ({ absn, gc, ctx }) => {
      if (ctx.isPlaying && !ctx.isPaused) {
        return { absn, gc, ctx: { ...ctx, playTime: absn.context.currentTime } }
      }
      return { absn, gc, ctx }
    }))
  }, [setAudioState])
  const startPlayingWatcher = useCallback(() => {
    if (playingWatcher) return
    const watcher = setInterval(syncAudioContext, 5)
    setPlayingWatcher(watcher)
  }, [playingWatcher, setPlayingWatcher, syncAudioContext])
  const stopPlayingWatcher = useCallback(() => {
    if (playingWatcher) {
      clearInterval(playingWatcher)
      setPlayingWatcher(undefined)
    }
  }, [playingWatcher, setPlayingWatcher])

  // MARK: play
  const play = useCallback(() => {
    setAudioState((prev) => {
      const newState = mapEntries(prev, ({ absn, gc, ctx }) => ({ absn, gc, ctx: { ...ctx, isPlaying: true, isPaused: false } }))
      Object.entries(newState).forEach(([k, { absn, ctx }]) => {
        absn.start(0, ctx.playTime)
        absn.onended = () => {
          ctx.isPlaying = false
          setAudioState(prev2 => ({ ...prev2, [k]: { absn, gc: prev2[k].gc, ctx: { ...prev2[k].ctx, isPlaying: false, playTime: ctx.maxTime } } }))
          if (Object.values(prev).every(({ ctx }) => !ctx.isPlaying)) {
            stopPlayingWatcher()
          }
        }
      })
      return newState
    })
    startPlayingWatcher()
  }, [startPlayingWatcher, stopPlayingWatcher])

  // MARK: pause
  const pause = useCallback(() => {
    setAudioState((prev) => {
      const newState = mapEntries(prev, ({ absn, gc, ctx }) => {
        if (ctx.isPlaying) {
          absn.stop()
          absn.onended = null
          return { absn, gc, ctx: { ...ctx, isPlaying: false, isPaused: true } }
        }
        return { absn, gc, ctx }
      })
      return newState
    })
    stopPlayingWatcher()
  }, [setAudioState, stopPlayingWatcher])

  // MARK: stop
  const stop = useCallback(() => {
    Object.entries(audioState).forEach(([, { absn }]) => {
      absn.stop()
      absn.onended = null
    })
    setAudioState(prev => mapEntries(prev, ({ absn, gc, ctx }) => ({ absn, gc, ctx: { ...ctx, isPlaying: false, isPaused: false, playTime: 0 } })))
    stopPlayingWatcher()
  }, [audioState, setAudioState, stopPlayingWatcher])

  // MARK: createAudioContext
  const createAudioContext = useCallback(async (uri: string, speed: number = 1, volume: number = 1): Promise<[AudioBufferSourceNode, GainNode]> => {
    const res = await fetch(uri)
    const buffer = await res.arrayBuffer()
    const gainController = audioContext.createGain()

    const audioBuffer = await audioContext.decodeAudioData(buffer)

    const absn = audioContext.createBufferSource()
    absn.buffer = audioBuffer
    absn.connect(audioContext.destination)
    absn.playbackRate.value = speed

    gainController.connect(audioContext.destination)
    gainController.gain.value = volume

    return [absn, gainController]
  }, [audioContext])

  // MARK: createContext
  const createContext = useCallback((ctx: Pick<Context, 'maxTime'> & Partial<Context>): Context => ({
    isPlaying: false,
    playTime: 0,
    volume: 1,
    speed: 1,
    ...ctx,
  }), [])

  // MARK: setSound
  const setSound = useCallback(async (soundKey: string, uri: string, speed: number = 1, volume: number = 1) => {
    const [absn, gainController] = await createAudioContext(uri, speed, volume)
    setAudioState({ [soundKey]: { absn, gc: gainController, ctx: createContext({ maxTime: absn.buffer!.duration, volume, speed }) } })
  }, [createAudioContext, createContext])

  // MARK: setSounds
  const setSounds = useCallback(async (sounds: { [k: string]: string | [uri: string, speed?: number, volume?: number] }) => {
    const audioContexts = await Promise.all(Object.entries(sounds).map(async ([k, v]) => {
      const [uri, speed, volume] = Array.isArray(v) ? v : [v]
      const [absn, gainController] = await createAudioContext(uri, speed, volume)
      return [k, { absn, gc: gainController, ctx: createContext({ maxTime: absn.buffer!.duration, volume, speed }) }]
    }))
    setAudioState(Object.fromEntries(audioContexts))
  }, [createAudioContext, createContext])

  // MARK: setVolume
  const setVolume = useCallback((soundKey: string, volume: number) => {
    setAudioState((prev) => {
      const { absn, gc, ctx } = prev[soundKey]
      gc.gain.value = volume
      return { ...prev, [soundKey]: { absn, gc, ctx: { ...ctx, volume } } }
    })
  }, [])

  // MARK: setSpeed
  const setSpeed = useCallback((soundKey: string, speed: number) => {
    setAudioState((prev) => {
      const { absn, gc, ctx } = prev[soundKey]
      absn.playbackRate.value = speed
      return { ...prev, [soundKey]: { absn, gc, ctx: { ...ctx, speed } } }
    })
  }, [])

  // MARK: setPlayTime
  const setPlayTime = useCallback((soundKey: string, playTime: number) => {
    setAudioState((prev) => {
      const { absn, gc, ctx } = prev[soundKey]
      absn.start(0, playTime)
      return { ...prev, [soundKey]: { absn, gc, ctx: { ...ctx, playTime } } }
    })
  }, [])

  const contexts = useMemo(() => mapEntries(audioState, ({ ctx }) => ctx), [audioState])

  const commands = useMemo(
    () => ({ play, pause, stop, setSound, setSounds, setVolume, setSpeed, setPlayTime }),
    [play, pause, stop, setSound, setSounds, setVolume, setSpeed, setPlayTime],
  )

  return { contexts, commands }
}
