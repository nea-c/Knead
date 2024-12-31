import React from 'react'
import { LuVolume1, LuVolume2, LuVolumeOff, LuVolumeX } from 'react-icons/lu'
import { ActionIcon, Slider, Group, HoverCard, Flex, Space, ThemeIcon, Center } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useAddDispatch, useAppSelector } from '../store/_store'
import { updateAppVolume } from '../store/fetchSlice'

export const VolumeChange = () => {
  const dispatch = useAddDispatch()

  const [MuteSwitch, { toggle: toggleMute }] = useDisclosure(false)

  const volumeSlider = useAppSelector(state => state.fetch.volumeSlider)

  const onChangeVolumeSlider = (value: number) => {
    dispatch(updateAppVolume({ volume: value, mute: MuteSwitch }))
  }

  const volumeIcon = (volume: number, mute: boolean) => {
    if (mute) return <LuVolumeX />
    else if (volume <= 0.0) return <LuVolumeOff />
    else if (volume <= 0.5) return <LuVolume1 />
    else return <LuVolume2 />
  }

  return (
    <Group justify="center">
      <HoverCard shadow="md">
        <HoverCard.Target>
          <ThemeIcon variant="outline" size="lg">
            {volumeIcon(volumeSlider, MuteSwitch)}
          </ThemeIcon>
        </HoverCard.Target>

        <HoverCard.Dropdown p={5}>
          <Group gap="sm" pr={3}>
            <ActionIcon onClick={toggleMute} variant="outline" size="lg">
              <LuVolumeX />
            </ActionIcon>
            <Slider value={volumeSlider} disabled={MuteSwitch} onChange={onChangeVolumeSlider} step={0.01} min={0} max={1} w={250} size="sm" label={null} />
          </Group>
        </HoverCard.Dropdown>

      </HoverCard>
    </Group>

  )
}
