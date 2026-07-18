import React, { useMemo, useState } from 'react'
import { Box, Button, Flex, NumberInput, Select, SelectItem, Slider, Text } from '@yamada-ui/react'
import {
  DEFAULT_RETRIGGER_INTERVAL,
  SINGLE_SHOT_CURVE_PREVIEW_TICKS,
  type Curve,
  type Marker,
} from '../types/timeline'
import { AudioSelectDropdown } from './AudioSelectDropdown'
import { CurveEditor } from './CurveEditor'

const PITCH_SNAP_VALUES = Array.from({ length: 25 }, (_, index) => 2 ** ((index - 12) / 12))
const PITCH_NOTE_NAMES = ['F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F']
const PITCH_SNAP_LABELS = Array.from({ length: 25 }, (_, index) => PITCH_NOTE_NAMES[index % 12])

interface Props {
  marker: Marker | null
  selectionCount: number
  selectedMarkers: Marker[]
  soundIdList: string[]
  variants: { path: string, hash: string }[]
  onChange: (patch: Partial<Marker>) => void
  onShiftTick: (delta: number) => void
  onBeginEdit: () => void
  onEndEdit: () => void
  soundFocusRequest: number
  onSoundFocusHandled: () => void
}

const PANEL_HEIGHT = 200
const PANEL_HEIGHT_WITH_CURVES = 420
const MIXED = Symbol('mixed')

function commonValue<T>(items: Marker[], get: (m: Marker) => T): T | typeof MIXED | null {
  if (items.length === 0) return null
  const first = get(items[0])
  for (let i = 1; i < items.length; i++) {
    if (get(items[i]) !== first) return MIXED
  }
  return first
}

export const TimelinePropertyPanel: React.FC<Props> = React.memo(function TimelinePropertyPanel({
  marker, selectionCount, selectedMarkers, soundIdList, variants,
  onChange, onShiftTick, onBeginEdit, onEndEdit, soundFocusRequest, onSoundFocusHandled,
}) {
  const [tickShift, setTickShift] = useState<number>(0)

  const variantItems: SelectItem[] = useMemo(() => [
    { label: 'ランダム', value: '-1' },
    ...variants.map((v, i) => ({ label: v.path, value: `${i}` })),
  ], [variants])

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

  const isMulti = selectionCount >= 2
  const showCurves = !isMulti && marker !== null
  const curveKeyframes = [
    ...(marker?.volumeCurve?.keyframes ?? []),
    ...(marker?.pitchCurve?.keyframes ?? []),
  ]
  const curveDuration = marker?.duration && marker.duration > 0
    ? marker.duration
    : Math.max(SINGLE_SHOT_CURVE_PREVIEW_TICKS, ...curveKeyframes.map(keyframe => keyframe.tick))

  const soundIdCommon = commonValue(selectedMarkers, m => m.soundId)
  const variantCommon = commonValue(selectedMarkers, m => m.variantIndex)
  const volumeCommon = commonValue(selectedMarkers, m => m.volume)
  const pitchCommon = commonValue(selectedMarkers, m => m.pitch)
  const durationCommon = commonValue(selectedMarkers, m => m.duration ?? 0)
  const retriggerCommon = commonValue(selectedMarkers, m => m.retriggerInterval ?? DEFAULT_RETRIGGER_INTERVAL)

  const displayVal = (v: unknown) => (v === MIXED || v === null ? '' : String(v))
  const displayNum = (v: unknown, fallback: number) => (v === MIXED || v === null ? fallback : (v as number))
  const isMixed = (v: unknown) => v === MIXED

  return (
    <Box
      h={`${showCurves ? PANEL_HEIGHT_WITH_CURVES : PANEL_HEIGHT}px`}
      bg="gray.900" borderTop="1px solid" borderColor="gray.700"
      p="4" overflowY="auto"
    >
      <Flex gap="6" wrap="wrap" align="flex-start">
        {!isMulti && marker !== null ? (
          <Box w="120px">
            <Text fontSize="sm" color="gray.400" mb="1">Tick</Text>
            <NumberInput
              value={marker.tick}
              min={0} step={1} precision={0}
              onChange={(_str, num) => {
                if (!Number.isNaN(num)) onChange({ tick: num })
              }}
              w="120px"
            />
          </Box>
        ) : (
          <Box w="240px">
            <Text fontSize="sm" color="gray.400" mb="1">Tick シフト (選択全体)</Text>
            <Flex gap="2">
              <NumberInput
                value={tickShift} step={1} precision={0}
                onChange={(_str, num) => { if (!Number.isNaN(num)) setTickShift(num) }}
                w="100px"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (tickShift === 0) return
                  onShiftTick(tickShift)
                  setTickShift(0)
                }}
                isDisabled={tickShift === 0 || selectedMarkers.length === 0}
              >
                適用
              </Button>
            </Flex>
          </Box>
        )}

        <Box w="240px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Sound
            {isMixed(soundIdCommon) && (
              <Text as="span" color="yellow.400" ml="2">(混在)</Text>
            )}
          </Text>
          <AudioSelectDropdown
            options={soundIdList}
            value={displayVal(soundIdCommon)}
            placeholder={isMixed(soundIdCommon) ? '(混在)' : '(未指定)'}
            onSelect={v => onChange({ soundId: v, variantIndex: -1 })}
            focusRequest={soundFocusRequest}
            onFocusRequestHandled={onSoundFocusHandled}
          />
        </Box>

        <Box w="320px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Variant
            {isMixed(variantCommon) && (
              <Text as="span" color="yellow.400" ml="2">(混在)</Text>
            )}
          </Text>
          <Select
            value={isMixed(variantCommon) ? '' : String(variantCommon ?? -1)}
            items={variantItems}
            onChange={v => onChange({ variantIndex: parseInt(v, 10) })}
            disabled={variants.length === 0 || isMixed(soundIdCommon)}
            w="320px"
            placeholder={isMixed(variantCommon) ? '(混在)' : undefined}
            placeholderInOptions={false}
          />
        </Box>

        <Box w="120px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Volume
            {isMixed(volumeCommon) && (
              <Text as="span" color="yellow.400" ml="2">(混在)</Text>
            )}
          </Text>
          <NumberInput
            value={displayNum(volumeCommon, 1)}
            min={0} step={0.1} precision={2}
            onChange={(_str, num) => {
              if (!Number.isNaN(num)) onChange({ volume: num })
            }}
            w="120px"
          />
        </Box>

        <Box w="220px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Pitch:
            {' '}
            {isMixed(pitchCommon) ? '(混在)' : (pitchCommon as number ?? 0).toFixed(2)}
          </Text>
          <Slider
            value={displayNum(pitchCommon, 0.5)}
            onChange={value => onChange({ pitch: value })}
            w="220px" h={10} step={0.01} min={0.5} max={2}
            filledTrackColor="gray.200" trackColor="gray.200" thumbColor="primary"
            thumbSize={2.5}
            focusThumbOnChange={false} readOnly={false}
            thumbProps={{
              _disabled: { color: 'primary' },
            }}
          />
        </Box>

        <Box w="140px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Duration (tick)
            {isMixed(durationCommon) && (
              <Text as="span" color="yellow.400" ml="2">(混在)</Text>
            )}
          </Text>
          <NumberInput
            value={displayNum(durationCommon, 0)}
            min={0} step={1} precision={0}
            onChange={(_str, num) => {
              if (!Number.isNaN(num)) {
                onChange({ duration: num > 0 ? num : undefined })
              }
            }}
            w="140px"
          />
          <Text fontSize="xs" color="gray.500" mt="1">0 = 単発</Text>
        </Box>

        <Box w="180px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Retrigger Interval (tick)
            {isMixed(retriggerCommon) && (
              <Text as="span" color="yellow.400" ml="2">(混在)</Text>
            )}
          </Text>
          <NumberInput
            value={displayNum(retriggerCommon, DEFAULT_RETRIGGER_INTERVAL)}
            min={1} step={1} precision={0}
            onChange={(_str, num) => {
              if (!Number.isNaN(num)) {
                onChange({ retriggerInterval: num > 0 ? num : undefined })
              }
            }}
            w="180px"
          />
          <Text fontSize="xs" color="gray.500" mt="1">連続モード時のみ有効</Text>
        </Box>
      </Flex>

      {showCurves && marker !== null && (
        <Flex gap="6" mt="4" wrap="wrap">
          <CurveEditor
            label="Volume カーブ"
            duration={curveDuration}
            valueMin={0} valueMax={Math.max(1, marker.volume)}
            fallback={marker.volume}
            curve={marker.volumeCurve}
            onChange={(next: Curve | undefined) => onChange({ volumeCurve: next })}
            onBeginEdit={onBeginEdit}
            onEndEdit={onEndEdit}
          />
          <CurveEditor
            label="Pitch カーブ"
            duration={curveDuration}
            valueMin={0.5} valueMax={2.0}
            fallback={marker.pitch}
            curve={marker.pitchCurve}
            referenceValue={1}
            snapValues={PITCH_SNAP_VALUES}
            snapValueLabels={PITCH_SNAP_LABELS}
            valueTooltip
            onChange={(next: Curve | undefined) => onChange({ pitchCurve: next })}
            onBeginEdit={onBeginEdit}
            onEndEdit={onEndEdit}
          />
        </Flex>
      )}
    </Box>
  )
})
