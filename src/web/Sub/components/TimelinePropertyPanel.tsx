import React from 'react'
import { Box, Flex, NumberInput, Select, SelectItem, Slider, Text } from '@yamada-ui/react'
import type { Marker } from '../types/timeline'

interface Props {
  marker: Marker | null
  selectionCount: number
  lengthTicks: number
  soundIdList: string[]
  variantCount: number
  onChange: (patch: Partial<Marker>) => void
}

const PANEL_HEIGHT = 180

export const TimelinePropertyPanel: React.FC<Props> = ({
  marker, selectionCount, lengthTicks, soundIdList, variantCount, onChange,
}) => {
  if (selectionCount === 0) {
    return (
      <Box
        h={`${PANEL_HEIGHT}px`} bg="gray.900" borderTop="1px solid" borderColor="gray.700"
        display="flex" alignItems="center" justifyContent="center"
      >
        <Text color="gray.500">マーカーを選択してください</Text>
      </Box>
    )
  }
  if (selectionCount >= 2 || marker === null) {
    return (
      <Box
        h={`${PANEL_HEIGHT}px`} bg="gray.900" borderTop="1px solid" borderColor="gray.700"
        display="flex" alignItems="center" justifyContent="center"
      >
        <Text color="gray.500">複数選択中（一括編集は Phase 3 以降）</Text>
      </Box>
    )
  }

  const soundItems: SelectItem[] = [
    { label: '(未指定)', value: '' },
    ...soundIdList.map(id => ({ label: id, value: id })),
  ]
  const variantItems: SelectItem[] = [
    { label: '-1: ランダム', value: '-1' },
    ...Array.from({ length: variantCount }, (_, i) => ({ label: `${i}`, value: `${i}` })),
  ]
  const maxTick = Math.max(0, lengthTicks - 1)

  return (
    <Box
      h={`${PANEL_HEIGHT}px`} bg="gray.900" borderTop="1px solid" borderColor="gray.700"
      p="4" overflow="auto"
    >
      <Flex gap="6" wrap="wrap" align="flex-start">
        <Box minW="120px">
          <Text fontSize="sm" color="gray.400" mb="1">Tick</Text>
          <NumberInput
            value={marker.tick}
            min={0} max={maxTick} step={1} precision={0}
            onChange={(_str, num) => {
              if (!Number.isNaN(num)) onChange({ tick: num })
            }}
            w="120px"
          />
        </Box>

        <Box minW="240px">
          <Text fontSize="sm" color="gray.400" mb="1">Sound</Text>
          <Select
            value={marker.soundId}
            items={soundItems}
            onChange={v => onChange({ soundId: v })}
            w="240px"
            placeholderInOptions={false}
          />
        </Box>

        <Box minW="140px">
          <Text fontSize="sm" color="gray.400" mb="1">Variant</Text>
          <Select
            value={String(marker.variantIndex)}
            items={variantItems}
            onChange={v => onChange({ variantIndex: parseInt(v, 10) })}
            disabled={variantCount === 0}
            w="140px"
            placeholderInOptions={false}
          />
        </Box>

        <Box minW="200px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Volume:
            {' '}
            {marker.volume.toFixed(2)}
          </Text>
          <Slider
            value={marker.volume}
            min={0} max={1} step={0.01}
            onChange={v => onChange({ volume: v })}
            w="200px"
            focusThumbOnChange={false}
          />
        </Box>

        <Box minW="200px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Pitch:
            {' '}
            {marker.pitch.toFixed(2)}
          </Text>
          <Slider
            value={marker.pitch}
            min={0.5} max={2.0} step={0.01}
            onChange={v => onChange({ pitch: v })}
            w="200px"
            focusThumbOnChange={false}
          />
        </Box>
      </Flex>
    </Box>
  )
}
