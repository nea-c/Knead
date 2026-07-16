import React from 'react'
import { Box, Flex, NumberInput, Select, SelectItem, Text } from '@yamada-ui/react'
import type { Marker } from '../types/timeline'
import { AudioSelectDropdown } from './AudioSelectDropdown'

interface Props {
  marker: Marker | null
  selectionCount: number
  lengthTicks: number
  soundIdList: string[]
  variants: { path: string, hash: string }[]
  onChange: (patch: Partial<Marker>) => void
}

const PANEL_HEIGHT = 200

export const TimelinePropertyPanel: React.FC<Props> = React.memo(function TimelinePropertyPanel({
  marker, selectionCount, lengthTicks, soundIdList, variants, onChange,
}) {
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

  const variantItems: SelectItem[] = [
    { label: 'ランダム', value: '-1' },
    ...variants.map((v, i) => ({ label: v.path, value: `${i}` })),
  ]
  const maxTick = Math.max(0, lengthTicks - 1)

  return (
    <Box
      h={`${PANEL_HEIGHT}px`} bg="gray.900" borderTop="1px solid" borderColor="gray.700"
      p="4"
    >
      <Flex gap="6" wrap="wrap" align="flex-start">
        <Box w="120px">
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

        <Box w="240px">
          <Text fontSize="sm" color="gray.400" mb="1">Sound</Text>
          <AudioSelectDropdown
            options={soundIdList}
            value={marker.soundId}
            placeholder="(未指定)"
            onSelect={v => onChange({ soundId: v })}
          />
        </Box>

        <Box w="320px">
          <Text fontSize="sm" color="gray.400" mb="1">Variant</Text>
          <Select
            value={String(marker.variantIndex)}
            items={variantItems}
            onChange={v => onChange({ variantIndex: parseInt(v, 10) })}
            disabled={variants.length === 0}
            w="320px"
            placeholderInOptions={false}
          />
        </Box>

        <Box w="220px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Volume:
            {' '}
            {marker.volume.toFixed(2)}
          </Text>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={marker.volume}
            onChange={e => onChange({ volume: parseFloat(e.target.value) })}
            style={{ width: '220px', accentColor: '#3b82f6' }}
          />
        </Box>

        <Box w="220px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Pitch:
            {' '}
            {marker.pitch.toFixed(2)}
          </Text>
          <input
            type="range"
            min={0.5} max={2.0} step={0.01}
            value={marker.pitch}
            onChange={e => onChange({ pitch: parseFloat(e.target.value) })}
            style={{ width: '220px', accentColor: '#3b82f6' }}
          />
        </Box>
      </Flex>
    </Box>
  )
})
