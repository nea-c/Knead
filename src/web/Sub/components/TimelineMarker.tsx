import React from 'react'
import { Box, Text } from '@yamada-ui/react'
import { TIMELINE_MARKER_SIZE, type Marker } from '../types/timeline'
import { tickToPx } from '../utils/tickPixel'

export type ResizeEdge = 'start' | 'end'

interface Props {
  marker: Marker
  invalidSound: boolean
  pxPerTick: number
  selected: boolean
  resizeCursor: boolean
  topPx: number
  onPointerDown: (edge: ResizeEdge | null, e: React.PointerEvent) => void
}

export const TimelineMarker: React.FC<Props> = ({
  marker, invalidSound, pxPerTick, selected, resizeCursor, topPx, onPointerDown,
}) => {
  const left = tickToPx(marker.tick, pxPerTick) - TIMELINE_MARKER_SIZE / 2
  const durationPx = marker.duration && marker.duration > 0
    ? tickToPx(marker.duration, pxPerTick)
    : 0
  const endpointFill = invalidSound ? 'red.500' : (selected ? 'blue.400' : 'gray.300')
  const endpointBorder = invalidSound ? 'red.200' : (selected ? 'blue.200' : 'gray.500')
  const lineColor = invalidSound ? 'red.800' : (selected ? 'blue.700' : 'gray.600')

  const endpoint = (edge: ResizeEdge, offset: number) => (
    <Box
      position="absolute"
      left={`${offset}px`}
      top="0"
      w={`${TIMELINE_MARKER_SIZE}px`}
      h={`${TIMELINE_MARKER_SIZE}px`}
      cursor={resizeCursor ? 'ew-resize' : 'grab'}
      _active={{ cursor: resizeCursor ? 'ew-resize' : 'grabbing' }}
      onPointerDown={e => onPointerDown(edge, e)}
    >
      <Box
        position="absolute"
        inset="0"
        transform="rotate(45deg) scale(0.78)"
        borderRadius="2px"
        bg={endpointFill}
        border="2px solid"
        borderColor={endpointBorder}
        pointerEvents="none"
      />
    </Box>
  )

  return (
    <Box
      position="absolute"
      left={`${left}px`}
      top={`${topPx}px`}
      transform="translateY(-50%)"
      w={`${TIMELINE_MARKER_SIZE + durationPx}px`}
      h={`${TIMELINE_MARKER_SIZE}px`}
      cursor="grab"
      _active={{ cursor: 'grabbing' }}
      onPointerDown={e => onPointerDown(null, e)}
      title={`t=${marker.tick} ${marker.soundId || '(no sound)'}`}
    >
      {durationPx > 0 && (
        <Box
          position="absolute"
          left={`${TIMELINE_MARKER_SIZE / 2}px`}
          top="50%"
          transform="translateY(-50%)"
          w={`${durationPx}px`}
          h="12px"
          bg={lineColor}
          pointerEvents="none"
        />
      )}
      {endpoint(durationPx > 0 ? 'start' : 'end', 0)}
      {durationPx > 0 && endpoint('end', durationPx)}
      {invalidSound && (
        <Text position="absolute" top="-14px" left="0" fontSize="10px" color="red.400">!</Text>
      )}
    </Box>
  )
}
