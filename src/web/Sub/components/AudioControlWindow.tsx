import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useVirtualScrollV2 } from '../../../hooks/useVirtualScrollV2'
import {
  Box,
  Flex,
  Button,
  Reorder,
  ReorderItem,
} from '@yamada-ui/react'
import { AudioGroup, AudioGroupHandle } from './AudioGroup'
import { useAudioLibrary } from '../../../hooks/useAudioLibrary'

interface Props {
  mainSelectedId?: string
}

// グループの状態型を拡張
interface GroupState {
  key: string
  soundId: string
  variantIndex: number
  volume: number
  pitch: number
}

export const AudioControlWindow: React.FC<Props> = ({ mainSelectedId }) => {
  useAudioLibrary()

  const keyCounter = useRef(0)
  // 初期値は1つだけ空のグループ
  const [groups, setGroups] = useState<GroupState[]>([
    {
      key: `grp-${keyCounter.current++}`,
      soundId: '',
      variantIndex: -1,
      volume: 1.0,
      pitch: 1.0,
    },
  ])
  const refs = useRef<Record<string, AudioGroupHandle>>({})
  const [itemHeights, _setItemHeights] = useState<number[]>([])
  const [_isPlaying, _setIsPlaying] = useState(false)
  const [footerState, setFooterState] = useState<'playing' | 'paused' | 'stopped'>(
    'stopped',
  )

  const makeKey = () => `grp-${keyCounter.current++}`

  // グループ追加
  const addGroup = useCallback(
    (initId?: string) =>
      setGroups(prev => [
        ...prev,
        {
          key: makeKey(),
          soundId: initId || '',
          variantIndex: -1,
          volume: 0.5,
          pitch: 1.0,
        },
      ]),
    [],
  )

  // グループ削除
  const handleRemoveGroup = useCallback((key: string) => {
    setGroups(prev => prev.filter(g => g.key !== key))
    delete refs.current[key]
  }, [])

  // 全体再生/一時停止/再開
  const playAll = useCallback(() => {
    Object.values(refs.current).forEach(r => r.play())
    _setIsPlaying(true)
  }, [])
  const pauseAll = useCallback(() => {
    Object.values(refs.current).forEach(r => r.pause && r.pause())
    _setIsPlaying(false)
  }, [])
  const resumeAll = useCallback(() => {
    Object.values(refs.current).forEach(r => r.resume && r.resume())
    _setIsPlaying(true)
  }, [])
  const stopAll = useCallback(() => {
    Object.values(refs.current).forEach(r => r.stop())
    _setIsPlaying(false)
  }, [])
  const restartAll = useCallback(() => {
    stopAll()
    setTimeout(playAll, 0)
  }, [stopAll, playAll])

  // 仮想化のセットアップ
  const FOOTER_HEIGHT = 68
  const [containerHeight, setContainerHeight] = useState(
    window.innerHeight - FOOTER_HEIGHT,
  )

  // ウィンドウサイズの変更を監視
  useEffect(() => {
    const handleResize = () => {
      setContainerHeight(window.innerHeight - FOOTER_HEIGHT)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const {
    containerRef,
    onScroll,
    visibleItems: _visibleItems,
    setItemHeight,
    totalHeight: _totalHeight,
  } = useVirtualScrollV2({
    itemCount: groups.length,
    _getItemKey: i => groups[i].key,
    _getItemHeight: i => itemHeights[i] || 120,
    containerHeight,
    overscan: 3,
  })

  // グループ複製
  const handleDuplicateGroup = useCallback((key: string) => {
    setGroups((prev) => {
      const idx = prev.findIndex(g => g.key === key)
      if (idx === -1) return prev
      const target = prev[idx]
      // copy
      const newGroup = { ...target, key: makeKey() }
      const next = [...prev]
      next.splice(idx + 1, 0, newGroup)
      return next
    })
  }, [])

  // グループの状態更新
  const handleGroupChange = useCallback(
    (key: string, patch: Partial<Omit<GroupState, 'key'>>) => {
      setGroups(prev =>
        prev.map(g => (g.key === key ? { ...g, ...patch } : g)),
      )
    },
    [],
  )

  // onRemove, onDuplicate を安定化
  const removeHandlers = React.useMemo(() => {
    const handlers: Record<string, () => void> = {}
    groups.forEach((g) => {
      handlers[g.key] = () => handleRemoveGroup(g.key)
    })
    return handlers
  }, [groups, handleRemoveGroup])

  const duplicateHandlers = React.useMemo(() => {
    const handlers: Record<string, () => void> = {}
    groups.forEach((g) => {
      handlers[g.key] = () => handleDuplicateGroup(g.key)
    })
    return handlers
  }, [groups, handleDuplicateGroup])

  // ref コールバックを安定化
  const groupRefs = React.useMemo(() => {
    const refMap: Record<string, (el: AudioGroupHandle | null) => void> = {}
    groups.forEach((g) => {
      refMap[g.key] = (el: AudioGroupHandle | null) => {
        if (el) refs.current[g.key] = el
        else delete refs.current[g.key]
      }
    })
    return refMap
  }, [groups])

  // Footer 用ステート更新（直接 ref.current から判定）
  useEffect(() => {
    const timer = setInterval(() => {
      const anyPlaying = Object.values(refs.current).some(
        r => r && r.isPlaying,
      )
      const anyPaused = Object.values(refs.current).some(
        r => r && r.isPaused,
      )
      if (anyPlaying) setFooterState('playing')
      else if (anyPaused) setFooterState('paused')
      else setFooterState('stopped')
    }, 200)
    return () => clearInterval(timer)
  }, [])

  return (
    <Box display="flex" flexDir="column" h="100vh">
      <Box
        ref={containerRef}
        onScroll={onScroll}
        flex="1"
        position="relative"
        overflowY="auto"
        p="4"
        h={`${containerHeight}px`}
      >
        <Box position="relative">
          <Reorder
            w="full"
            orientation="vertical"
            onChange={(keys: string[]) => {
              const reordered = keys.map(k =>
                groups.find(g => g.key === k)!,
              )
              setGroups(reordered)
            }}
          >
            {groups.map(
              ({ key, soundId, variantIndex, volume, pitch }) => (
                <ReorderItem key={key} value={key}>
                  <AudioGroup
                    key={key}
                    initialSoundId={soundId}
                    initialVariantIndex={variantIndex}
                    initialVolume={volume}
                    initialPitch={pitch}
                    onRemove={removeHandlers[key]}
                    onDuplicate={duplicateHandlers[key]}
                    onChange={patch => handleGroupChange(key, patch)}
                    ref={groupRefs[key]}
                  />
                </ReorderItem>
              ),
            )}
          </Reorder>
        </Box>
        {groups.length === 0 && (
          <Box textAlign="center" color="gray.500">
            グループがありません。
          </Box>
        )}
      </Box>
      <Flex
        as="footer"
        pos="sticky"
        bottom="0"
        bg="gray.900"
        p="4"
        justify="space-between"
        borderTop="1px solid"
        borderColor="gray.700"
      >
        <Button onClick={restartAll} colorScheme="gray">
          リスタート
        </Button>
        {footerState === 'playing'
          ? (
              <Button onClick={pauseAll} colorScheme="red">
                停止
              </Button>
            )
          : footerState === 'paused'
            ? (
                <Button onClick={resumeAll} colorScheme="green">
                  再開
                </Button>
              )
            : (
                <Button onClick={playAll} colorScheme="green">
                  再生
                </Button>
              )}
        <Button onClick={() => addGroup()} colorScheme="blue">
          ＋ グループ追加
        </Button>
        <Button
          onClick={() => addGroup(mainSelectedId)}
          colorScheme="blue"
          isDisabled={!mainSelectedId}
        >
          メイン選択IDで追加
        </Button>
      </Flex>
    </Box>
  )
}
