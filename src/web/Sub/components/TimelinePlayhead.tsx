import React from 'react'
import { Box } from '@yamada-ui/react'
import { tickToPx } from '../utils/tickPixel'

interface Props {
  currentTick: number
  pxPerTick: number
  heightPx: number
}

export const TimelinePlayhead: React.FC<Props> = ({ currentTick, pxPerTick, heightPx }) => {
  const left = tickToPx(currentTick, pxPerTick)
  return (
    <Box
      position="absolute"
      left={`${left}px`}
      top="0"
      w="2px"
      h={`${heightPx}px`}
      bg="red.500"
      pointerEvents="none"
      zIndex={10}
    />
  )
}
