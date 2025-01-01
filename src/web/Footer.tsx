import { Box, Flex, ActionIcon, Input, NumberInput, Select, Slider, Text, Tooltip, Container, Stack, Divider, rem, CopyButton, Group } from '@mantine/core'
import { useClipboard, useDisclosure } from '@mantine/hooks'
import { FaPlay, FaPause, FaArrowRotateLeft } from 'react-icons/fa6'
import { LuCheck, LuCopy, LuSlash, LuMegaphoneOff } from 'react-icons/lu'
import { PiTildeBold, PiCaretUpBold, PiSelectionBold } from 'react-icons/pi'
import { useAddDispatch, useAppSelector } from '../store/_store'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SoundName, updateSelectedSound } from '../store/fetchSlice'
import { isAboveVersion, VersionInfoType } from '../types/VersionInfo'
import { useAudioPlay } from './hooks/useAudioPlay'
import { useTranslation } from 'react-i18next'
import { PitchInput } from './PitchInput'
import { secondsToString } from '../utils/NumberUtil'

const { myAPI } = window

export const Footer = () => {
  const { t } = useTranslation()
  const dispatch = useAddDispatch()
  const AudioController = useAudioPlay()

  const sounds = useAppSelector(state => state.fetch.sounds)
  const selectedSound = useAppSelector(state => state.fetch.selectedSound)
  const soundSelectDetector = useAppSelector(state => state.fetch.soundSelectDetector)
  const targetVersion = useAppSelector(state => state.fetch.targetVersion)
  const appVolume = useAppSelector(state => state.fetch.appVolume)

  const isTargetVersion24w09aOrHigher = ([
    { kind: 'release', raw: '', major: 1, minor: 20, patch: 5 },
    { kind: 'release-candidate', raw: '', major: 1, minor: 20, patch: 5, releaseNumber: 1 },
    { kind: 'pre-release', raw: '', major: 1, minor: 20, patch: 5, releaseNumber: 1 },
    { kind: 'snapshot', raw: '', year: 24, releaseNumber: 9, letter: '' },
  ] satisfies VersionInfoType[]).some(v => isAboveVersion(targetVersion, v))

  const isTargetVersion17w45aOrHigher = ([
    { kind: 'release', raw: '', major: 1, minor: 13, patch: 0 },
    { kind: 'release-candidate', raw: '', major: 1, minor: 13, patch: 0, releaseNumber: 1 },
    { kind: 'pre-release', raw: '', major: 1, minor: 13, patch: 0, releaseNumber: 1 },
    { kind: 'snapshot', raw: '', year: 17, releaseNumber: 45, letter: '' },
  ] satisfies VersionInfoType[]).some(v => isAboveVersion(targetVersion, v))

  const isTargetVersion15w49aOrHigher = ([
    { kind: 'release', raw: '', major: 1, minor: 9, patch: 0 },
    { kind: 'release-candidate', raw: '', major: 1, minor: 9, patch: 0, releaseNumber: 1 },
    { kind: 'pre-release', raw: '', major: 1, minor: 9, patch: 0, releaseNumber: 1 },
    { kind: 'snapshot', raw: '', year: 15, releaseNumber: 49, letter: '' },
  ] satisfies VersionInfoType[]).some(v => isAboveVersion(targetVersion, v))

  // const PlaySourceItems: SelectItem[] = [
  //   { label: 'ambient', value: 'ambient' },
  //   { label: 'block', value: 'block' },
  //   { label: 'hostile', value: 'hostile' },
  //   { label: 'music', value: 'music' },
  //   { label: 'neutral', value: 'neutral' },
  //   { label: 'player', value: 'player' },
  //   { label: 'record', value: 'record' },
  //   { label: 'voice', value: 'voice' },
  //   { label: 'weather', value: 'weather' },
  //   {
  //     label: t('not_recommended'),
  //     items: [
  //       { label: 'master', value: 'master' },
  //     ],
  //   },
  // ]

  const clipboard = useClipboard()

  // スラッシュスイッチ
  const [SlashSwitch, { toggle: toggleSlash }] = useDisclosure(false)

  // サウンドを流すターゲット(masterとか)
  const [PlaySource, setPlaySource] = useState('master')

  // ピッチ関係
  const [pitch, setPitch] = useState('1')

  // 座標指定関系
  const coordinateChars = ['~', '^']
  const [Coordinate, setCoordinate] = useState('')
  const [CoordinateError, { open: onCoordinateError, close: offCoordinateError }] = useDisclosure(false)

  // セレクター関系
  const [Selector, setSelector] = useState('@a')
  const [SelectorError, { open: onSelectorError, close: offSelectorError }] = useDisclosure(false)
  const [SelectorX0, { toggle: toggleSelectorX0 }] = useDisclosure(true)

  // ボリューム(生成)関係
  const [MaxVolume, setMaxVolume] = useState(1)
  const [MinVolume, setMinVolume] = useState(0)
  const onChangeMaxVolumeInput = (_: string, value: number) => setMaxVolume(value)
  const onChangeMinVolumeInput = (_: string, value: number) => setMinVolume(value)

  const onChangePitch = useCallback((value: string) => {
    setPitch(value)
    if (selectedSound) AudioController.commands.setSpeed(selectedSound, parseFloat(value))
  }, [AudioController.commands, selectedSound])

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
      return `${newCoordinateChar}${formattedCoordinates[0]} ${newCoordinateChar}${formattedCoordinates[1]} ${newCoordinateChar}${formattedCoordinates[2]}`
    })
  }
  const onClickTilde = () => onChangeCoordinateChar('~')
  const onClickCaret = () => onChangeCoordinateChar('^')
  const onClickRemoveSymbol = () => setCoordinate('')

  const onChangeSelector = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // スペースを削除した文字列を入手
    // const selector = e.target.value.replaceAll(" ", "")

    // コンマでスプリット > イコールでスプリット

    // offSelectorError()
    setSelector(e.target.value)
  }, [setSelector])

  // コマンド生成
  // 1.20.5(24w09a)以降は<source>と<selector>を省略できるようになった
  // 1.13(17w45a)以降は<selector>の記述方式が変更された
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

    const CorrectedSelector = Selector == '@a' ? (SelectorX0 ? '@a[x=0]' : Selector) : Selector

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
      ].join(' '))
      : ''
  }, [Coordinate, selectedSound, SlashSwitch, isTargetVersion15w49aOrHigher, isTargetVersion24w09aOrHigher, PlaySource, Selector, MaxVolume, pitch, MinVolume, SelectorX0])

  useEffect(() => {
    (async () => {
      if (selectedSound) {
        const targetSound = sounds.filter(sound => sound.id == selectedSound)[0]
        const targetHashes = targetSound?.sounds ?? []
        const sound = targetHashes[Math.floor(Math.random() * targetHashes.length)]
        try {
          const hash = await myAPI.get_mcSoundHash(sound?.hash ?? '')
          await AudioController.commands.setSound(selectedSound, hash)
          AudioController.commands.play()
        }
        catch (e: unknown) {
          alert(e)
        }
      }
    })()
  }, [AudioController.commands, selectedSound, sounds])

  return (
    <>
      <footer className="fixed_bottom">
        <Stack w="full" bg="footerBackground" p={7} style={{ borderTop: '1px solid', borderColor: 'inherit', userSelect: 'none' }}>

          {/* <Box alignContent="center" paddingX={1}>
            <Slider
              step={0.01} defaultValue={0} min={0} max={100}
              value={AudioController.contexts.head ? AudioController.contexts.head.playbackTime * 100 / AudioController.contexts.head.maxTime : 0}
              filledTrackColor="primary" thumbColor="primary" trackColor="gray.200"
              thumbSize={2.5} thumbProps={{ _focusVisible: { boxShadow: '' } }}
            />
          </Box>

          <Flex w="full" marginTop={2}>
            <ActionIcon onClick={AudioController.commands.stop} icon={<FaArrowRotateLeft size={20} />} variant="ghost" />
            <Spacer maxW={1} />
            <ActionIcon
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

          <Flex w="full" marginTop={1}>
            <Tooltip label={t('add_slash')} placement="bottom" animation="top">
              <Toggle variant="outline" colorScheme="primary" icon={<SlashIcon fontSize="lg" />} onClick={toggleSlash} />
            </Tooltip>
            <Spacer maxW={1} />
            <Tooltip label={t('play_source')} placement="bottom" animation="top">
              <Select disabled={!isTargetVersion15w49aOrHigher} items={PlaySourceItems} onChange={setPlaySource} defaultValue="master" placeholderInOptions={false} w={32} animation="bottom" listProps={{ padding: 0, margin: 0 }} />
            </Tooltip>
            <Spacer />
            <Tooltip label={t('max_volume')} placement="bottom" animation="top">
              <NumberInput onChange={onChangeMaxVolumeInput} w={32} defaultValue={1.0} precision={2} min={0.0} step={0.1} />
            </Tooltip>
            <Spacer maxW={1} />
            <Tooltip label={t('min_volume')} placement="bottom" animation="top">
              <NumberInput onChange={onChangeMinVolumeInput} w={32} defaultValue={0.0} precision={2} min={0.0} max={1.0} step={0.1} />
            </Tooltip>
          </Flex>

          <Flex w="full" marginTop={1}>
            <Tooltip label={t('coordinate')} placement="bottom" animation="top">
              <Input value={Coordinate} onChange={onChangeCoordinate} invalid={CoordinateError} w="calc(full - xs)" placeholder={t('coordinate')} />
            </Tooltip>
            <Spacer maxW={10} />
            <Tooltip label={t('tilde_symbol')} placement="bottom" animation="top">
              <Box border="1px solid" borderColor="inherit" borderRadius={5}>
                <ActionIcon onClick={onClickTilde} icon={<PiTildeBold size={20} />} variant="ghost" />
              </Box>
            </Tooltip>
            <Spacer maxW={1} />
            <Tooltip label={t('caret_symbol')} placement="bottom" animation="top">
              <Box border="1px solid" borderColor="inherit" borderRadius={5}>
                <ActionIcon onClick={onClickCaret} icon={<PiCaretUpBold size={20} />} variant="ghost" />
              </Box>
            </Tooltip>
            <Spacer maxW={1} />
            <Tooltip label={t('symbol_clear')} placement="bottom" animation="top">
              <Box border="1px solid" borderColor="inherit" borderRadius={5}>
                <ActionIcon onClick={onClickRemoveSymbol} icon={<PiSelectionBold size={20} />} variant="ghost" />
              </Box>
            </Tooltip>
          </Flex>

          <Flex w="full" marginTop={1}>
            <Tooltip label={t('selector')} placement="bottom" animation="top">
              <Input onChange={onChangeSelector} invalid={SelectorError} defaultValue="@a" w="calc(full - xs)" placeholder={t('selector')} />
            </Tooltip>
            <Spacer maxW={10} />
            <Tooltip label={t('this_dimension_only')} placement="bottom" animation="top" maxW="full">
              <Toggle onClick={toggleSelectorX0} variant="outline" colorScheme="primary" defaultSelected icon={<LuMegaphoneOff />} />
            </Tooltip>
          </Flex>
          */}

          <Container w="100%" h="xl" mt={1} p={0}>
            <Group p={0} grow>
              <Tooltip label={t('selector')} position="top">
                <Input onChange={onChangeSelector} error={SelectorError} defaultValue="@a" w="calc(full - xs)" placeholder={t('selector')} />
              </Tooltip>
            </Group>
          </Container>

          <Container w="100%" h="xl" mt={1} style={{ border: '1px solid', borderColor: 'bg', borderRadius: 5 }}>
            <Group justify="flex-start" grow w="100%">
              <Container px={3} style={{ userSelect: 'none' }}>
                {command}
                {/* test */}
              </Container>

              <Group justify="flex-end">
                <Divider orientation="vertical" />

                <CopyButton value={command} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy'} position="top">
                      <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy} mx={7} w={20}>
                        {copied ? (<LuCheck style={{ width: rem(16) }} />) : (<LuCopy style={{ width: rem(16) }} />)}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Group>
          </Container>

        </Stack>
      </footer>
    </>
  )
}
