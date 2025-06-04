import React, { useState, useEffect } from 'react'
import { Volume1Icon, Volume2Icon, VolumeOffIcon, VolumeXIcon } from '@yamada-ui/lucide'
import { Box, Flex, Slider, Toggle, useBoolean } from '@yamada-ui/react'

export const VolumeChange = () => {
  const [MuteSwitch, { toggle: toggleMute }] = useBoolean(false)

  const [volumeSlider, setVolumeSlider] = useState<number>(1)

  useEffect(() => {
    (async () => {
      const volume = await window.myAPI.getSetting('volume') as number
      setVolumeSlider(volume ?? 1)
      sessionStorage.setItem('appVolume', `${volume}`)
    })()
  }, [])

  const onClickMute = () => {
    console.log(volumeSlider)
    const appVolume = !MuteSwitch ? 0 : volumeSlider
    sessionStorage.setItem('appVolume', `${appVolume}`)
    toggleMute()
  }

  const onChangeVolumeSlider = (value: number) => {
    setVolumeSlider(value)
    const appVolume = MuteSwitch ? 0 : value
    sessionStorage.setItem('appVolume', `${appVolume}`)
  }

  const volumeIcon = (volume: number, mute: boolean) => {
    if (mute) return <VolumeXIcon fontSize="xl" />
    else if (volume <= 0.0) return <VolumeOffIcon fontSize="xl" />
    else if (volume <= 0.5) return <Volume1Icon fontSize="xl" />
    else return <Volume2Icon fontSize="xl" />
  }

  return (
    <Flex>
      <Toggle icon={volumeIcon(volumeSlider, MuteSwitch)} onClick={onClickMute} variant="outline" colorScheme={MuteSwitch ? 'red' : 'primary'} />
      <Box w="full" textAlign="center" paddingX={2}>
        <Slider
          value={volumeSlider} disabled={MuteSwitch} onChange={onChangeVolumeSlider}
          marginBottom={-2} step={0.01} min={0} max={1} w={40}
          filledTrackColor="primary" trackColor="gray.200" thumbColor="primary"
          thumbSize={2.5}
          focusThumbOnChange={false} readOnly={false}
          thumbProps={{
            _disabled: { color: 'primary' },
          }}
        />
      </Box>
    </Flex>

  )
}
