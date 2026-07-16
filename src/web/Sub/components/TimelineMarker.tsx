import React from 'react'
import { Box, Text } from '@yamada-ui/react'
import type { Marker } from '../types/timeline'
import { tickToPx } from '../utils/tickPixel'

interface Props {
  marker: Marker
  pxPerTick: number
  selected: boolean
  onPointerDown: (e: React.PointerEvent) => void
}

const MARKER_SIZE = 16

export const TimelineMarker: React.FC<Props> = ({ marker, pxPerTick, selected, onPointerDown }) => {
  const left = tickToPx(marker.tick, pxPerTick) - MARKER_SIZE / 2
  const durationPx = marker.duration && marker.duration > 0
    ? tickToPx(marker.duration, pxPerTick)
    : 0
  return (
    <>
      {durationPx > 0 && (
        <Box
          position="absolute"
          left={`${left + MARKER_SIZE / 2}px`}
          top="50%"
          transform="translateY(-50%)"
          w={`${durationPx}px`}
          h="8px"
          bg={selected ? 'blue.500' : 'gray.500'}
          opacity={0.6}
          borderRadius="sm"
          pointerEvents="none"
        />
      )}
      <Box
        position="absolute"
        left={`${left}px`}
        top="50%"
        transform="translateY(-50%)"
        w={`${MARKER_SIZE}px`}
        h={`${MARKER_SIZE}px`}
        borderRadius="full"
        bg={selected ? 'blue.400' : 'gray.300'}
        border="2px solid"
        borderColor={selected ? 'blue.200' : 'gray.500'}
        cursor="grab"
        _active={{ cursor: 'grabbing' }}
        onPointerDown={onPointerDown}
        title={`t=${marker.tick} ${marker.soundId || '(no sound)'}`}
      >
        {marker.soundId === '' && (
          <Text position="absolute" top="-14px" left="0" fontSize="10px" color="red.400">!</Text>
        )}
      </Box>
    </>
  )
}
