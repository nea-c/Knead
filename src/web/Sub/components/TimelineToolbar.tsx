import React from 'react'
import { Flex, Button, Text, Box } from '@yamada-ui/react'

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
}

export const TimelineToolbar: React.FC<Props> = ({
  onAddMarker, onDeleteSelected, canDelete,
  onOpen, onSave, onSaveAs, dirty, filePath,
  onTogglePlay, onStop, isPlaying,
}) => {
  const fileName = filePath ? filePath.replace(/^.*[\\\/]/, '') : '(未保存)'
  return (
    <Flex align="center" gap="2" p="2" bg="gray.900" borderBottom="1px solid" borderColor="gray.700">
      <Button size="sm" onClick={onOpen}>開く</Button>
      <Button size="sm" onClick={onSave}>保存</Button>
      <Button size="sm" onClick={onSaveAs}>名前を付けて保存</Button>
      <Box w="1px" h="20px" bg="gray.600" mx="1" />
      <Button size="sm" colorScheme={isPlaying ? 'red' : 'green'} onClick={onTogglePlay}>{isPlaying ? '■停止' : '▶再生'}</Button>
      <Button size="sm" onClick={onStop} isDisabled={!isPlaying}>■リセット</Button>
      <Box w="1px" h="20px" bg="gray.600" mx="1" />
      <Button size="sm" colorScheme="blue" onClick={onAddMarker}>+ マーカー追加</Button>
      <Button size="sm" colorScheme="red" onClick={onDeleteSelected} isDisabled={!canDelete}>削除</Button>
      <Box flex="1" />
      <Text fontSize="sm" color={dirty ? 'yellow.300' : 'gray.400'}>
        {dirty ? '* ' : ''}{fileName}
      </Text>
    </Flex>
  )
}
