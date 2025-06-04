import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useMemo,
  useRef,
  useCallback,
  memo,
} from 'react'
import {
  Box,
  Flex,
  IconButton,
  Select,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
  Text,
  FormControl,
} from '@yamada-ui/react'
import { FaPlay, FaPause, FaTrash, FaCopy } from 'react-icons/fa6'
import { useAudioPlay } from '../../../hooks/useAudioPlayV2'
import { useAudioLibrary } from '../../../hooks/useAudioLibrary'
import { AudioSelectDropdown } from './AudioSelectDropdown'

export interface AudioGroupHandle {
  play(): void
  stop(): void
  pause(): void
  resume(): void
  get isPlaying(): boolean
  get isPaused(): boolean
  get isFinished(): boolean
}

interface Props {
  initialSoundId?: string
  initialVariantIndex?: number
  initialVolume?: number
  initialPitch?: number
  onRemove(): void
  onDuplicate?(): void
  onChange?(patch: Partial<{
    soundId: string
    variantIndex: number
    volume: number
    pitch: number
  }>): void
}

const AudioGroupComponent = forwardRef<AudioGroupHandle, Props>(
  (
    {
      initialSoundId,
      initialVariantIndex = 0,
      initialVolume = 1.0,
      initialPitch = 1.0,
      onRemove,
      onDuplicate,
      onChange,
    },
    ref,
  ) => {
    const { soundIdList, soundMap, loaded } = useAudioLibrary()
    const [isLoading, setIsLoading] = useState(false)

    const [selectedId, setSelectedId] = useState(initialSoundId || '')
    const [variantIndex, setVariantIndex] = useState(initialVariantIndex)
    const [volume, setVolume] = useState(initialVolume)
    const [pitch, setPitch] = useState(initialPitch)
    const [audioSrc, setAudioSrc] = useState<string | null>(null)
    const [pauseTime, setPauseTime] = useState(0)

    // 直前の値を保持する ref
    const prevSelectedIdRef = useRef<string>(initialSoundId || '')
    const prevVariantRef = useRef<number>(initialVariantIndex)
    const prevVolumeRef = useRef<number>(initialVolume)
    const prevPitchRef = useRef<number>(initialPitch)

    // variantsをuseMemoで初期化
    const variants = useMemo(
      () => (selectedId ? soundMap[selectedId] || [] : []),
      [selectedId, soundMap],
    )
    const selectedVariant = variants[variantIndex]

    // 親から新しい初期値を受け取ったときだけstate更新
    useEffect(() => {
      setSelectedId(initialSoundId || '')
    }, [initialSoundId])

    useEffect(() => {
      setVariantIndex(initialVariantIndex)
    }, [initialVariantIndex])

    useEffect(() => {
      setVolume(initialVolume)
    }, [initialVolume])

    useEffect(() => {
      setPitch(initialPitch)
    }, [initialPitch])

    // 値が変わった時だけ呼ぶ
    useEffect(() => {
      if (prevSelectedIdRef.current === selectedId) return
      prevSelectedIdRef.current = selectedId
      onChange?.({ soundId: selectedId })
    }, [selectedId, onChange])

    useEffect(() => {
      if (prevVariantRef.current === variantIndex) return
      prevVariantRef.current = variantIndex
      onChange?.({ variantIndex })
    }, [variantIndex, onChange])

    useEffect(() => {
      if (prevVolumeRef.current === volume) return
      prevVolumeRef.current = volume
      onChange?.({ volume })
    }, [volume, onChange])

    useEffect(() => {
      if (prevPitchRef.current === pitch) return
      prevPitchRef.current = pitch
      onChange?.({ pitch })
    }, [pitch, onChange])

    // variants の長さが変わったら variantIndex をリセット
    const prevVariantsLengthRef = useRef(variants.length)
    useEffect(() => {
      if (variants.length !== prevVariantsLengthRef.current) {
        setVariantIndex(-1)
      }
      prevVariantsLengthRef.current = variants.length
    }, [variants.length, variantIndex])

    // selectedVariant が変わったら audioSrc を更新
    useEffect(() => {
      const setPath = async () => {
        if (selectedVariant?.hash) {
          const absPath = await window.myAPI.get_mcSoundHash(
            selectedVariant.hash,
          )
          setAudioSrc(absPath ? 'file://' + absPath : null)
        }
        else {
          setAudioSrc(null)
        }
      }
      setPath()
    }, [selectedVariant?.hash])

    const {
      play,
      stop,
      pause,
      resume,
      setVolume: setVol,
      setPitch: setPit,
      isPlaying,
      isPaused,
      isFinished,
    } = useAudioPlay(audioSrc, volume, pitch, pauseTime, setPauseTime)

    // スライダー操作があったら hook に渡す、副作用
    useEffect(() => {
      setVol(volume)
    }, [volume, setVol])

    useEffect(() => {
      setPit(pitch)
    }, [pitch, setPit])

    // 親から play/stop/pause/resume を呼べるよう useImperativeHandle
    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          if (variantIndex === -1 && variants.length > 0) {
            const playIndex = Math.floor(Math.random() * variants.length)
            const playVariant = variants[playIndex]
            if (playVariant?.hash) {
              const absPath = await window.myAPI.get_mcSoundHash(
                playVariant.hash,
              )
              setAudioSrc(absPath ? 'file://' + absPath : null)
              setTimeout(async () => {
                try {
                  await play()
                }
                catch (e) {
                  console.error('Error playing audio:', e)
                }
              }, 10)
            }
          }
          else {
            if (audioSrc) {
              try {
                await play()
              }
              catch (e) {
                console.error('Error playing audio:', e)
              }
            }
          }
        },
        stop: async () => {
          try {
            await stop()
          }
          catch (e) {
            console.error('Error stopping audio:', e)
          }
        },
        pause: async () => {
          try {
            await pause()
          }
          catch (e) {
            console.error('Error pausing audio:', e)
          }
        },
        resume: async () => {
          try {
            await resume()
          }
          catch (e) {
            console.error('Error resuming audio:', e)
          }
        },
        get isPlaying() {
          return isPlaying
        },
        get isPaused() {
          return isPaused
        },
        get isFinished() {
          return isFinished
        },
      }),
      [
        audioSrc,
        play,
        stop,
        pause,
        resume,
        isPlaying,
        isPaused,
        isFinished,
        variantIndex,
        variants,
      ],
    )

    const handleSoundSelect = useCallback(
      async (id: string) => {
        if (isLoading) return
        try {
          setIsLoading(true)
          await stop()
          setSelectedId(id)
        }
        catch (e) {
          console.error('Error selecting sound:', e)
        }
        finally {
          setIsLoading(false)
        }
      },
      [isLoading, stop],
    )

    const soundIdOptions = useMemo(
      () => soundIdList.map(id => ({ label: id, value: id })),
      [soundIdList],
    )

    const variantOptions = useMemo(
      () => [
        { label: 'Random', value: 'random' },
        ...variants.map((_, i) => ({
          label: `Variant ${i + 1}`,
          value: String(i),
        })),
      ],
      [variants],
    )

    // audioSrc を一度 null にしてから再セット
    const restartAudio = useCallback(async () => {
      setAudioSrc(null)
      if (selectedVariant?.hash) {
        const absPath = await window.myAPI.get_mcSoundHash(
          selectedVariant.hash,
        )
        setTimeout(() => {
          setAudioSrc(absPath ? 'file://' + absPath : null)
        }, 10)
      }
    }, [selectedVariant])

    return (
      <Box bg="gray.800" p="3" mb="2" borderRadius="md">
        <Flex align="center" mb="2">
          {/* 再生 / 一時停止 / 再開 ボタン */}
          <IconButton
            aria-label={
              isPlaying ? '一時停止' : isPaused ? '再開' : '再生'
            }
            icon={isPlaying ? <FaPause /> : <FaPlay />}
            onClick={async () => {
              if (isPlaying) {
                await pause()
              }
              else if (isPaused) {
                await resume()
              }
              else if (isFinished) {
                await stop()
                await play()
              }
              else {
                await stop()
                await play()
              }
            }}
            mr="3"
            disabled={
              !loaded || isLoading || (variantIndex !== -1 && !audioSrc)
            }
          />

          {/* サウンド ID 選択 */}
          <FormControl id="sound-id" flex="1" mr="3">
            <AudioSelectDropdown
              options={soundIdList}
              value={selectedId}
              placeholder="サウンドID選択…"
              onSelect={handleSoundSelect}
              height={300}
              isDisabled={isLoading}
            />
          </FormControl>

          {/* バリアント選択 */}
          <FormControl id="variant" w="150px" mr="3">
            {typeof document !== 'undefined' && (
              <Select
                placeholder="Variant"
                items={variantOptions}
                portalProps={{
                  containerRef:
                    ({ current: document.body } as React.RefObject<
                      HTMLElement
                    >),
                }}
                contentProps={{
                  bg: 'gray.700',
                  borderColor: 'gray.600',
                  zIndex: 999,
                }}
                value={
                  variantIndex === -1 ? 'random' : String(variantIndex)
                }
                onChange={(v) => {
                  if (v === 'random') {
                    setVariantIndex(-1)
                  }
                  else {
                    setVariantIndex(Number(v))
                  }
                }}
                size="sm"
              />
            )}
          </FormControl>

          {/* 複製ボタン */}
          <IconButton
            aria-label="グループ複製"
            icon={<FaCopy />}
            colorScheme="blue"
            variant="ghost"
            onClick={onDuplicate}
            mr="2"
          />

          {/* 削除ボタン */}
          <IconButton
            aria-label="グループ削除"
            icon={<FaTrash />}
            colorScheme="red"
            variant="ghost"
            onClick={async () => {
              await stop()
              if (window.confirm('本当に削除しますか？')) {
                onRemove()
              }
            }}
          />
        </Flex>

        <Flex align="center">
          {/* ピッチ */}
          <Flex align="center" mr="6">
            <Text fontSize="sm" mr="2">
              ピッチ
            </Text>
            <Slider
              value={pitch}
              min={0.5}
              max={2.0}
              step={0.01}
              onChange={v => setPitch(v)}
              w="125px"
              trackColor="gray.200"
              filledTrackColor="gray.200"
              thumbColor="primary"
            >
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderMark
                value={pitch}
                bg="blue.500"
                color="white"
                py="0.4"
                rounded="md"
                w="10"
                mt="3"
                ml="-5"
              >
                {pitch.toFixed(2)}
              </SliderMark>
              <SliderThumb />
            </Slider>
          </Flex>

          {/* 音量 */}
          <Flex align="center">
            <Text fontSize="sm" mr="2">
              音量
            </Text>
            <Slider
              value={volume}
              onChange={v => setVolume(v)}
              min={0}
              max={1}
              step={0.01}
              w="125px"
              trackColor="gray.200"
              filledTrackColor="primary"
              thumbColor="primary"
            >
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb />
              <SliderMark
                value={volume}
                bg="blue.500"
                color="white"
                py="0.4"
                rounded="md"
                w="10"
                mt="3"
                ml="-5"
              >
                {(volume * 100).toFixed(0)}
                %
              </SliderMark>
            </Slider>
          </Flex>
        </Flex>
      </Box>
    )
  },
)

AudioGroupComponent.displayName = 'AudioGroup'

// 再レンダー抑制
const areEqual = (prev: Props, next: Props) => {
  return (
    prev.initialSoundId === next.initialSoundId
    && prev.initialVariantIndex === next.initialVariantIndex
    && prev.initialVolume === next.initialVolume
    && prev.initialPitch === next.initialPitch
    && prev.onRemove === next.onRemove
    && prev.onDuplicate === next.onDuplicate
  )
}

export const AudioGroup = memo(AudioGroupComponent, areEqual)
