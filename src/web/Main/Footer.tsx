import { Box, Flex, IconButton, Input, NumberInput, SelectRoot as Select, Separator, SliderRoot as Slider, Spacer, Text, Toggle, Tooltip, useBoolean, useClipboard, type ComboboxItem as SelectItem } from '@yamada-ui/react'
import { FaPlay, FaPause, FaArrowRotateLeft } from 'react-icons/fa6'
import { CheckIcon, CopyIcon, SlashIcon, MegaphoneOffIcon } from '@yamada-ui/lucide'
import { PiTildeBold, PiCaretUpBold, PiSelectionBold } from 'react-icons/pi'
import { useAddDispatch, useAppSelector } from '../../store/_store'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { updateSelectedSound } from '../../store/fetchSlice'
import { isAboveVersion, VersionInfoType } from '../../types/VersionInfo'
import { useAudioPlay } from '../../hooks/useAudioPlay'
import { useTranslation } from 'react-i18next'
import { PitchInput } from './PitchInput'
import { secondsToString } from '../../utils/NumberUtil'
import { SelectorCheck } from '../../utils/SelectorCheck'

export const Footer = () => {
  const { t } = useTranslation()
  const dispatch = useAddDispatch()
  const AudioController = useAudioPlay()
  const isPlayingRef = useRef(false)

  const sounds = useAppSelector(state => state.fetch.sounds)
  const selectedSound = useAppSelector(state => state.fetch.selectedSound)
  const soundSelectDetector = useAppSelector(state => state.fetch.soundSelectDetector)
  const targetVersion: VersionInfoType | undefined = useAppSelector(state => state.fetch.targetVersion ?? undefined)

  const volume = parseFloat(localStorage.getItem('volume') ?? '1')
  const appVolume = parseFloat(sessionStorage.getItem('appVolume') ?? `${volume}`)
  if (!sessionStorage.getItem('appVolume')) sessionStorage.setItem('appVolume', `${volume}`)
  useEffect(() => {
    if (selectedSound && AudioController.context.isSomePlaying) AudioController.commands.setVolume(selectedSound, appVolume - 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appVolume])

  // 1.20.5(24w09a)以降は<source>と<selector>を省略できるようになった
  const isTargetVersion24w09aOrHigher = ([
    { kind: 'release', raw: '', major: 1, minor: 20, patch: 5 },
    { kind: 'release-candidate', raw: '', major: 1, minor: 20, patch: 5, releaseNumber: 0 },
    { kind: 'pre-release', raw: '', major: 1, minor: 20, patch: 5, releaseNumber: 0 },
    { kind: 'snapshot', raw: '', year: 24, releaseNumber: 9, letter: '' },
  ] satisfies VersionInfoType[]).some(v => isAboveVersion(targetVersion, v))

  // 1.13(17w45a)以降は<selector>の記述方式が変更された
  const isTargetVersion17w45aOrHigher = ([
    { kind: 'release', raw: '', major: 1, minor: 13, patch: 0 },
    { kind: 'release-candidate', raw: '', major: 1, minor: 13, patch: 0, releaseNumber: 0 },
    { kind: 'pre-release', raw: '', major: 1, minor: 13, patch: 0, releaseNumber: 0 },
    { kind: 'snapshot', raw: '', year: 17, releaseNumber: 45, letter: '' },
  ] satisfies VersionInfoType[]).some(v => isAboveVersion(targetVersion, v))

  // 1.12(17w16b)以降は@sが追加された
  const isTargetVersion17w16bOrHigher = ([
    { kind: 'release', raw: '', major: 1, minor: 12, patch: 0 },
    { kind: 'release-candidate', raw: '', major: 1, minor: 12, patch: 0, releaseNumber: 0 },
    { kind: 'pre-release', raw: '', major: 1, minor: 12, patch: 0, releaseNumber: 0 },
    { kind: 'snapshot', raw: '', year: 17, releaseNumber: 16, letter: 'b' },
  ] satisfies VersionInfoType[]).some(v => isAboveVersion(targetVersion, v))

  // 1.9(15w49a)以降は<source>が必要になった
  const isTargetVersion15w49aOrHigher = ([
    { kind: 'release', raw: '', major: 1, minor: 9, patch: 0 },
    { kind: 'release-candidate', raw: '', major: 1, minor: 9, patch: 0, releaseNumber: 0 },
    { kind: 'pre-release', raw: '', major: 1, minor: 9, patch: 0, releaseNumber: 0 },
    { kind: 'snapshot', raw: '', year: 15, releaseNumber: 49, letter: '' },
  ] satisfies VersionInfoType[]).some(v => isAboveVersion(targetVersion, v))

  // 1.8(14w02a)以降は@eが追加された
  const isTargetVersion14w02aOrHigher = ([
    { kind: 'release', raw: '', major: 1, minor: 8, patch: 0 },
    { kind: 'release-candidate', raw: '', major: 1, minor: 8, patch: 0, releaseNumber: 0 },
    { kind: 'pre-release', raw: '', major: 1, minor: 8, patch: 0, releaseNumber: 0 },
    { kind: 'snapshot', raw: '', year: 14, releaseNumber: 2, letter: '' },
  ] satisfies VersionInfoType[]).some(v => isAboveVersion(targetVersion, v))

  const PlaySourceItems: SelectItem[] = [
    { label: 'ambient', value: 'ambient' },
    { label: 'block', value: 'block' },
    { label: 'hostile', value: 'hostile' },
    { label: 'music', value: 'music' },
    { label: 'neutral', value: 'neutral' },
    { label: 'player', value: 'player' },
    { label: 'record', value: 'record' },
    { label: 'voice', value: 'voice' },
    { label: 'weather', value: 'weather' },
    {
      label: t('not_recommended'),
      items: [
        { label: 'master', value: 'master' },
      ],
    },
  ]

  const { onCopy, copied: hasCopied } = useClipboard()
  // シークバー
  const [seekbar, setSeekbar] = useState(0)

  // スラッシュスイッチ
  const [SlashSwitch, { toggle: toggleSlash }] = useBoolean(false)

  // サウンドを流すターゲット(masterとか)
  const [PlaySource, setPlaySource] = useState('')

  useEffect(() => {
    (async () => {
      const playbackCategory = await window.myAPI.getSetting('playbackCategory') as string
      setPlaySource(playbackCategory ?? 'player')
    })()
  }, [])

  const onChangePlaySource = (v: string) => {
    window.myAPI.updateSettings({ playbackCategory: v })
    setPlaySource(v)
  }

  // ピッチ関係
  const [pitch, setPitch] = useState('1')

  // 座標指定関系
  const coordinateChars = ['~', '^']
  const [Coordinate, setCoordinate] = useState('')
  const [CoordinateError, { on: onCoordinateError, off: offCoordinateError }] = useBoolean(false)

  // セレクター関系
  const [Selector, setSelector] = useState('@a')
  const [SelectorError, { on: onSelectorError, off: offSelectorError }] = useBoolean(false)
  const [SelectorX0, { toggle: toggleSelectorX0 }] = useBoolean(true)

  // ボリューム(生成)関係
  const [MaxVolume, setMaxVolume] = useState(1)
  const [MinVolume, setMinVolume] = useState(0)
  const onChangeMaxVolumeInput = (_: string, value: number) => setMaxVolume(value)
  const onChangeMinVolumeInput = (_: string, value: number) => setMinVolume(value)

  const onChangePitch = useCallback((value: string) => {
    setPitch(value)
    if (selectedSound) AudioController.commands.setSpeed(selectedSound, parseFloat(value))
  }, [AudioController.commands, selectedSound])

  useEffect(() => {
    if (!AudioController.contexts.head) return
    setSeekbar(AudioController.contexts.head.playbackTime * 100 / (AudioController.contexts.head.maxTime))
  }, [AudioController.contexts.head, pitch])

  const onChangeSeekbar = (value: number) => {
    const percent = value / 100
    setSeekbar(value)
    if (!AudioController.contexts.head) return
    const playbackTime = (AudioController.contexts.head?.maxTime ?? 0) * percent
    AudioController.commands.setPlaybackTime(selectedSound, playbackTime)
  }

  const onChangeCoordinate = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value

    // 条件に応じてエラー表示を行う
    // if (/([\^\~]?[\d]{1,})*/g.test(str) || str === "") offCoordinateError()
    // else onCoordinateError()

    setCoordinate(e.target.value)
  }, [setCoordinate])
  const onChangeCoordinateChar = (newCoordinateChar: string) => {
    setCoordinate((prev) => {
      const splitCoordinate: number[] = coordinateChars.reduce((prev, char) => prev.replaceAll(char, ''), prev).split(' ').map(v => Number(v))
      const formattedCoordinates = splitCoordinate.map(v => v != 0 && !Number.isNaN(v) ? v?.toString() : '')
      // シンボル削除時
      if (newCoordinateChar === '') {
        // 0でない数値が1つ以上あるか
        const HasIndexes: boolean = splitCoordinate.map(v => v != 0).some(v => v)
        // なければ何もない文字列を返す
        if (!HasIndexes) return ''
        // 3回ループ
        const returnCoordinate: string[] = []
        for (let i = 0; i <= 2; i++) {
          returnCoordinate.push((typeof splitCoordinate[i] === 'number' && splitCoordinate[i] != 0 && splitCoordinate[i].toString() != 'NaN') ? splitCoordinate[i].toString() : (HasIndexes ? '0' : ''))
        }
        return returnCoordinate.join(' ')
      }
      return `${newCoordinateChar}${formattedCoordinates[0] ?? ''} ${newCoordinateChar}${formattedCoordinates[1] ?? ''} ${newCoordinateChar}${formattedCoordinates[2] ?? ''}`
    })
  }
  const onClickTilde = () => onChangeCoordinateChar('~')
  const onClickCaret = () => onChangeCoordinateChar('^')
  const onClickRemoveSymbol = () => onChangeCoordinateChar('')

  const onChangeSelector = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const [valid, _] = SelectorCheck(e.target.value, SelectorX0)

    // セレクターが有効でないならエラーON
    if (!valid) return onSelectorError()
    else offSelectorError()

    setSelector(e.target.value)
  }, [SelectorX0, offSelectorError, onSelectorError])

  // コマンド生成
  // 1.20.5(24w09a)以降は<source>と<selector>を省略できるようになった
  // 1.9(15w49a)以降は<source>が必要になった
  const command = useMemo(() => {
    const splitCoordinate: number[] = Coordinate.replaceAll('~', '').replaceAll('^', '').split(' ').map(v => v == '' ? NaN : Number(v))
    const HasIndexes: boolean = splitCoordinate.filter(v => v.toString() != 'NaN').length > 0
    const returnCoordinate: string[] = ['']
    for (let i = 0; i <= 2; i++) {
      returnCoordinate.push((typeof splitCoordinate[i] === 'number' && splitCoordinate[i] != 0 && splitCoordinate[i].toString() != 'NaN') ? splitCoordinate[i].toString() : (HasIndexes ? '0' : ''))
      if (HasIndexes && i < 2) returnCoordinate.push(' ')
    }
    const CorrectedCoordinate = Coordinate.includes('~') ? Coordinate : Coordinate.includes('^') ? Coordinate : returnCoordinate.join('')

    const [_, CorrectedSelector] = SelectorCheck(Selector, SelectorX0)

    return selectedSound != ''
      ? ([
          (SlashSwitch ? '/' : '') + 'playsound',
          selectedSound,
          (!isTargetVersion15w49aOrHigher ? undefined : ((isTargetVersion24w09aOrHigher && PlaySource == 'master' && CorrectedSelector == '@s' && Coordinate == '' && MaxVolume == 1 && pitch == '1' && MinVolume == 0) ? '' : PlaySource)),
          ((isTargetVersion24w09aOrHigher && CorrectedSelector == '@s' && Coordinate == '' && MaxVolume == 1 && pitch == '1' && MinVolume == 0) ? '' : CorrectedSelector),
          ((CorrectedCoordinate == '' && MaxVolume == 1 && pitch == '1' && MinVolume == 0) ? '' : (CorrectedCoordinate == '' ? '~ ~ ~' : CorrectedCoordinate)),
          ((MaxVolume == 1 && pitch == '1' && MinVolume == 0) ? '' : MaxVolume),
          ((pitch == '1' && MinVolume == 0) ? '' : pitch),
          (MinVolume == 0 ? '' : MinVolume),
        ].join(' ')).trim()
      : ''
  }, [Coordinate, selectedSound, SlashSwitch, isTargetVersion15w49aOrHigher, isTargetVersion24w09aOrHigher, PlaySource, Selector, MaxVolume, pitch, MinVolume, SelectorX0])

  useEffect(() => {
    (async () => {
      if (isPlayingRef.current) return

      try {
        isPlayingRef.current = true

        await AudioController.commands.stop()

        if (selectedSound) {
          const targetSound = sounds.filter(sound => sound.id == selectedSound)[0]
          const targetHashes = targetSound?.sounds ?? []
          const sound = targetHashes[Math.floor(Math.random() * targetHashes.length)]
          let target_pitch = parseFloat(pitch) * sound.pitch
          if (target_pitch < 0.5) target_pitch = 0.5
          else if (target_pitch > 2) target_pitch = 2

          try {
            const data = await window.myAPI.get_mcSoundData(sound?.hash ?? '')
            // 再度stopを呼び出して確実に停止させる
            await AudioController.commands.stop()
            await AudioController.commands.setSound(selectedSound, data, target_pitch, appVolume - 1)
            await new Promise(resolve => setTimeout(resolve, 50))
            AudioController.commands.play()
          }
          catch (e: unknown) {
            alert(e)
          }
        }
      }
      finally {
        isPlayingRef.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundSelectDetector])

  return (
    <>
      <footer className="fixed_bottom">
        <Box w="full" bg="footerBackground" padding={2} borderTop="1px solid" borderColor="inherit">

          <Box alignContent="center" paddingX={1} style={{ userSelect: 'none' }}>
            <Slider
              value={seekbar}
              onChange={onChangeSeekbar}
              step={0.01} min={0} max={100}
              rangeFill="primary" trackFill="gray.200" thumbFill="primary"
              thumbSize={2.5}
              readOnly={false}
              thumbProps={{
                _disabled: { color: 'primary' },
              }}
            />
          </Box>

          <Flex w="full" marginTop={2} style={{ userSelect: 'none' }}>
            <IconButton onClick={() => dispatch(updateSelectedSound({ id: selectedSound }))} icon={<FaArrowRotateLeft size={20} />} variant="ghost" />
            <Spacer maxW={1} />
            <IconButton
              onClick={AudioController.context.isSomePlaying ? AudioController.commands.pause : AudioController.commands.play}
              icon={AudioController.context.isSomePlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
              variant="ghost"
            />
            <Spacer maxW={1} />
            <Text alignContent="center" paddingX={1} style={{ userSelect: 'none' }} fontSize="lg">
              {secondsToString(AudioController.contexts.head?.playbackTime ?? 0, 100)}
              {' / '}
              {secondsToString(AudioController.contexts.head?.maxTime ?? 0, 100)}
            </Text>
            <Spacer />
            <PitchInput pitch={pitch} onChange={onChangePitch} />
          </Flex>

          <Flex w="full" marginTop={1} style={{ userSelect: 'none' }}>
            <Tooltip content={t('add_slash')} placement="end">
              <Toggle variant="outline" colorScheme="primary" icon={<SlashIcon fontSize="xl" />} onClick={toggleSlash} />
            </Tooltip>
            <Spacer maxW={1} />
            <Tooltip content={t('play_source')} placement="end">
              <Select value={PlaySource} disabled={!isTargetVersion15w49aOrHigher} items={PlaySourceItems} onChange={onChangePlaySource} w={32} animation="bottom" contentProps={{ padding: 0, margin: 0 }} />
            </Tooltip>
            <Spacer />
            <Tooltip content={t('max_volume')} placement="end">
              <NumberInput onChange={onChangeMaxVolumeInput} w={32} defaultValue={1.0} precision={2} min={0.0} step={0.1} />
            </Tooltip>
            <Spacer maxW={1} />
            <Tooltip content={t('min_volume')} placement="end">
              <NumberInput onChange={onChangeMinVolumeInput} w={20} defaultValue={0.0} precision={2} min={0.0} max={1.0} step={0.1} />
            </Tooltip>
          </Flex>

          <Flex w="full" marginTop={1} style={{ userSelect: 'none' }}>
            <Tooltip content={t('coordinate')} placement="end">
              <Input value={Coordinate} onChange={onChangeCoordinate} invalid={CoordinateError} w="calc(full - xs)" placeholder={t('coordinate')} />
            </Tooltip>
            <Spacer maxW={10} />
            <Tooltip content={t('tilde_symbol')} placement="end">
              <IconButton onClick={onClickTilde} icon={<PiTildeBold size={20} />} variant="outline" borderColor="inherit" />
            </Tooltip>
            <Spacer maxW={1} />
            <Tooltip content={t('caret_symbol')} placement="end">
              <IconButton onClick={onClickCaret} icon={<PiCaretUpBold size={20} />} variant="outline" borderColor="inherit" />
            </Tooltip>
            <Spacer maxW={1} />
            <Tooltip content={t('symbol_clear')} placement="end">
              <IconButton onClick={onClickRemoveSymbol} icon={<PiSelectionBold size={20} />} variant="outline" borderColor="inherit" />
            </Tooltip>
          </Flex>

          <Flex w="full" marginTop={1} style={{ userSelect: 'none' }}>
            <Tooltip content={t('selector')} placement="end">
              <Input onChange={onChangeSelector} invalid={SelectorError} defaultValue="@a" w="calc(full - xs)" placeholder={t('selector')} />
            </Tooltip>
            <Spacer maxW={10} />
            <Tooltip content={t('this_dimension_only')} placement="end" contentProps={{ maxW: 'full' }}>
              <Toggle onClick={toggleSelectorX0} variant="outline" colorScheme="primary" defaultChecked icon={<MegaphoneOffIcon fontSize="xl" />} />
            </Tooltip>
          </Flex>

          <Box w="full" marginTop={1} border="1px solid" borderColor="bg" borderRadius={5}>
            <Flex>
              <Box alignContent="center" paddingX={3}>{command}</Box>
              <Spacer />
              <Box><Separator orientation="vertical" borderColor="bg" /></Box>
              <Tooltip content={hasCopied ? 'Copied!' : 'Copy'} placement="end">
                <IconButton icon={hasCopied ? <CheckIcon color="success" marginX={6} /> : <CopyIcon marginX={6} />} onClick={() => onCopy(command)} variant="ghost" borderLeftRadius={0} borderRightRadius={2} />
              </Tooltip>
            </Flex>
          </Box>

        </Box>
      </footer>
    </>
  )
}
