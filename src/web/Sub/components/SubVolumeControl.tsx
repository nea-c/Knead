import React from 'react'
import { Volume1Icon, Volume2Icon, VolumeOffIcon, VolumeXIcon } from '@yamada-ui/lucide'
import { Box, Flex, Slider, Toggle } from '@yamada-ui/react'

interface Props {
  volume: number
  muted: boolean
  onChangeVolume: (v: number) => void
  onToggleMute: () => void
}

export const SubVolumeControl: React.FC<Props> = ({ volume, muted, onChangeVolume, onToggleMute }) => {
  const icon = (() => {
    if (muted) return <VolumeXIcon fontSize="xl" />
    if (volume <= 0.0) return <VolumeOffIcon fontSize="xl" />
    if (volume <= 0.5) return <Volume1Icon fontSize="xl" />
    return <Volume2Icon fontSize="xl" />
  })()

  return (
    <Flex align="center" gap="1">
      <Toggle
        icon={icon}
        onClick={onToggleMute}
        variant="outline"
        colorScheme={muted ? 'red' : 'primary'}
        size="sm"
      />
      <Box w="120px" px="2">
        <Slider
          value={volume} disabled={muted} onChange={onChangeVolume}
          marginBottom={-2} step={0.01} min={0} max={1}
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
