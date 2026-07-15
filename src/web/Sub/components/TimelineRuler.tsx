import React, { useCallback, useMemo } from 'react'
import { Box } from '@yamada-ui/react'
import { tickToPx, pxToTick } from '../utils/tickPixel'

interface Props {
  lengthTicks: number
  pxPerTick: number
  onSeek?: (tick: number) => void
}

export const TimelineRuler: React.FC<Props> = ({ lengthTicks, pxPerTick, onSeek }) => {
  const totalPx = tickToPx(lengthTicks, pxPerTick)

  const ticks = useMemo(() => {
    const arr: { tick: number, major: boolean }[] = []
    for (let t = 0; t <= lengthTicks; t += 5) {
      arr.push({ tick: t, major: t % 10 === 0 })
    }
    return arr
  }, [lengthTicks])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!onSeek) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    onSeek(pxToTick(x, pxPerTick))
  }, [onSeek, pxPerTick])

  return (
    <Box
      position="relative"
      h="24px"
      w={`${totalPx}px`}
      bg="gray.900"
      borderBottom="1px solid"
      borderColor="gray.700"
      cursor={onSeek ? 'pointer' : 'default'}
      onClick={handleClick}
    >
      {ticks.map(({ tick, major }) => {
        const left = tickToPx(tick, pxPerTick)
        return (
          <Box
            key={tick}
            position="absolute"
            left={`${left}px`}
            top={major ? '4px' : '12px'}
            bottom="0"
            w="1px"
            bg={major ? 'gray.400' : 'gray.600'}
          >
            {major && (
              <Box
                position="absolute"
                top="-2px"
                left="2px"
                fontSize="10px"
                color="gray.300"
                whiteSpace="nowrap"
              >
                {tick}
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
