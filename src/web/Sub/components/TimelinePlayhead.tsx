import React from 'react'
import { Box } from '@yamada-ui/react'
import { tickToPx } from '../utils/tickPixel'

interface Props {
  currentTick: number
  pxPerTick: number
  heightPx: number
}

const HEAD_SIZE = 10

export const TimelinePlayhead: React.FC<Props> = ({ currentTick, pxPerTick, heightPx }) => {
  const left = tickToPx(currentTick, pxPerTick)
  return (
    <Box
      position="absolute"
      left={`${left}px`}
      top="0"
      pointerEvents="none"
      zIndex={10}
    >
      {/* 見つけやすくするための三角形のヘッド (M17) */}
      <Box
        position="absolute"
        top="0"
        left={`-${HEAD_SIZE / 2}px`}
        w="0"
        h="0"
        borderLeft={`${HEAD_SIZE / 2}px solid transparent`}
        borderRight={`${HEAD_SIZE / 2}px solid transparent`}
        borderTop={`${HEAD_SIZE * 0.7}px solid`}
        borderTopColor="red.500"
      />
      <Box
        position="absolute"
        top={`${HEAD_SIZE * 0.7}px`}
        left="-1px"
        w="2px"
        h={`${Math.max(0, heightPx - HEAD_SIZE * 0.7)}px`}
        bg="red.500"
      />
    </Box>
  )
}
