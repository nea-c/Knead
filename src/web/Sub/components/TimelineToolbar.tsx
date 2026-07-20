import React from 'react'
import { Flex, Button, Text, Box } from '@yamada-ui/react'
import { SubVolumeControl } from './SubVolumeControl'

interface Props {
  onAddMarker: () => void
  onDeleteSelected: () => void
  canDelete: boolean
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  dirty: boolean
  filePath: string | null
  onTogglePlay: () => void
  onStop: () => void
  isPlaying: boolean
  currentTick: number
  preloading: boolean
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  volume: number
  muted: boolean
  onChangeVolume: (v: number) => void
  onToggleMute: () => void
}

export const TimelineToolbar: React.FC<Props> = ({
  onAddMarker, onDeleteSelected, canDelete,
  onOpen, onSave, onSaveAs, dirty, filePath,
  onTogglePlay, onStop, isPlaying, currentTick, preloading,
  onUndo, onRedo, canUndo, canRedo,
  volume, muted, onChangeVolume, onToggleMute,
}) => {
  const fileName = filePath ? filePath.replace(/^.*[\\\/]/, '') : '(未保存)'
  return (
    <Flex align="center" gap="2" p="2" bg="gray.900" borderBottom="1px solid" borderColor="gray.700">
      <Button size="sm" onClick={onOpen}>開く</Button>
      <Button size="sm" onClick={onSave}>保存</Button>
      <Button size="sm" onClick={onSaveAs}>名前を付けて保存</Button>
      <Box w="1px" h="20px" bg="gray.600" mx="1" />
      <Button size="sm" onClick={onUndo} disabled={!canUndo} title="Ctrl+Z">↺ 元に戻す</Button>
      <Button size="sm" onClick={onRedo} disabled={!canRedo} title="Ctrl+Y / Ctrl+Shift+Z">↻ やり直し</Button>
      <Box w="1px" h="20px" bg="gray.600" mx="1" />
      <Button
        size="sm"
        colorScheme={preloading ? 'gray' : isPlaying ? 'red' : 'green'}
        onClick={onTogglePlay}
        disabled={preloading}
      >
        {preloading ? '読込中…' : (isPlaying ? '⏸一時停止' : '▶再生')}
      </Button>
      <Button size="sm" onClick={onStop} disabled={currentTick <= 0}>■リセット</Button>
      <Box w="1px" h="20px" bg="gray.600" mx="1" />
      <Button size="sm" colorScheme="blue" onClick={onAddMarker}>+ マーカー追加</Button>
      <Button size="sm" colorScheme="red" onClick={onDeleteSelected} disabled={!canDelete}>削除</Button>
      <Box w="1px" h="20px" bg="gray.600" mx="1" />
      <SubVolumeControl
        volume={volume}
        muted={muted}
        onChangeVolume={onChangeVolume}
        onToggleMute={onToggleMute}
      />
      <Box flex="1" />
      <Text fontSize="sm" color={dirty ? 'yellow.300' : 'gray.400'}>
        {dirty ? '* ' : ''}
        {fileName}
      </Text>
    </Flex>
  )
}
