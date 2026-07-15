import React from 'react'
import { Flex, Button } from '@yamada-ui/react'

interface Props {
  onAddMarker: () => void
  onDeleteSelected: () => void
  canDelete: boolean
}

export const TimelineToolbar: React.FC<Props> = ({ onAddMarker, onDeleteSelected, canDelete }) => {
  return (
    <Flex align="center" gap="2" p="2" bg="gray.900" borderBottom="1px solid" borderColor="gray.700">
      <Button size="sm" colorScheme="blue" onClick={onAddMarker}>+ マーカー追加</Button>
      <Button size="sm" colorScheme="red" onClick={onDeleteSelected} isDisabled={!canDelete}>削除</Button>
    </Flex>
  )
}
