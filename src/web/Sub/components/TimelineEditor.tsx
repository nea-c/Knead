// src/web/Sub/components/TimelineEditor.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box } from '@yamada-ui/react'
import { useTimeline } from '../hooks/useTimeline'
import { useAudioBufferCache } from '../hooks/useAudioBufferCache'
import { useTimelinePlayback } from '../hooks/useTimelinePlayback'
import { DEFAULT_PX_PER_TICK, tickToPx } from '../utils/tickPixel'
import { parse, serialize } from '../utils/timelineIO'
import { TimelineToolbar } from './TimelineToolbar'
import { TimelineRuler } from './TimelineRuler'
import { TimelineTrack } from './TimelineTrack'
import { TimelinePlayhead } from './TimelinePlayhead'

interface Props {
  defaultSoundId?: string
}

export const TimelineEditor: React.FC<Props> = ({ defaultSoundId }) => {
  const timeline = useTimeline()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const cache = useAudioBufferCache()
  const playback = useTimelinePlayback({
    markers: timeline.state.markers,
    lengthTicks: timeline.state.lengthTicks,
    cache,
  })
  const pxPerTick = DEFAULT_PX_PER_TICK
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // state 変更でダーティ化（初回マウント時は無視）
  const firstRenderRef = useRef(true)
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return }
    setDirty(true)
  }, [timeline.state])

  // ウィンドウタイトルに未保存マーク * を反映
  useEffect(() => {
    const name = filePath ? filePath.replace(/^.*[\\\/]/, '') : '(未保存)'
    document.title = `${dirty ? '* ' : ''}Knead - ${name}`
  }, [dirty, filePath])

  // マーカー配列変化のたびにキャッシュを再プリロード（差分だけロード）
  useEffect(() => {
    const ids = Array.from(new Set(timeline.state.markers.map(m => m.soundId).filter(Boolean)))
    cache.preload(ids).catch(err => console.error('preload failed', err))
  }, [timeline.state.markers, cache])

  const handleAddAtTick = useCallback((tick: number) => {
    const id = timeline.addMarker({ tick, soundId: defaultSoundId ?? '' })
    setSelectedIds(new Set([id]))
  }, [timeline, defaultSoundId])

  const handleAddAtPlayhead = useCallback(() => {
    handleAddAtTick(Math.round(playback.currentTick))
  }, [handleAddAtTick, playback.currentTick])

  const handleSelect = useCallback((id: string | null) => {
    setSelectedIds(id === null ? new Set() : new Set([id]))
  }, [])

  const handleDeleteSelected = useCallback(() => {
    for (const id of selectedIds) timeline.removeMarker(id)
    setSelectedIds(new Set())
  }, [selectedIds, timeline])

  const confirmDiscardIfDirty = useCallback((): boolean => {
    if (!dirty) return true
    return window.confirm('未保存の変更があります。破棄しますか？')
  }, [dirty])

  const handleOpen = useCallback(async () => {
    if (!confirmDiscardIfDirty()) return
    const res = await window.myAPI.timeline.openDialog()
    if (!res) return
    const parsed = parse(res.json)
    if (!parsed.ok) {
      window.alert(`読込エラー: ${parsed.error}`)
      return
    }
    timeline.replaceAll(parsed.state)
    setFilePath(res.path)
    setSelectedIds(new Set())
    setDirty(false)
    if (parsed.warnings.length > 0) window.alert(`警告:\n${parsed.warnings.join('\n')}`)
  }, [timeline, confirmDiscardIfDirty])

  const handleSaveAs = useCallback(async () => {
    const json = serialize(timeline.state)
    const savedPath = await window.myAPI.timeline.saveDialog(filePath ?? 'timeline.kp', json)
    if (savedPath) {
      setFilePath(savedPath)
      setDirty(false)
    }
  }, [timeline.state, filePath])

  const handleSave = useCallback(async () => {
    // filePath があってもダイアログを出さないパスは今回未実装（メインプロセス側に別 IPC が要る）
    // 現状は「保存」も常にダイアログを出す（Save As と同等）
    await handleSaveAs()
  }, [handleSaveAs])

  // キーボードショートカット
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) { e.preventDefault(); handleDeleteSelected() }
      }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        setSelectedIds(new Set(timeline.state.markers.map(m => m.id)))
      }
      else if (e.key === 'Escape') {
        setSelectedIds(new Set())
      }
      else if (e.key === ' ') {
        e.preventDefault()
        if (playback.isPlaying) playback.stop()
        else playback.play()
      }
      else if (e.key === 'Home') {
        e.preventDefault()
        playback.seek(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, timeline.state.markers, handleDeleteSelected, playback])

  const sortedMarkers = useMemo(
    () => [...timeline.state.markers].sort((a, b) => a.tick - b.tick),
    [timeline.state.markers],
  )

  const contentWidth = tickToPx(timeline.state.lengthTicks, pxPerTick)
  const trackAreaHeight = 24 + 64  // Ruler + Track

  return (
    <Box display="flex" flexDir="column" h="100vh" bg="gray.950">
      <TimelineToolbar
        onAddMarker={handleAddAtPlayhead}
        onDeleteSelected={handleDeleteSelected}
        canDelete={selectedIds.size > 0}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        dirty={dirty}
        filePath={filePath}
        onTogglePlay={() => playback.isPlaying ? playback.stop() : playback.play()}
        onStop={() => playback.stop()}
        isPlaying={playback.isPlaying}
      />
      <Box ref={scrollRef} flex="1" overflow="auto">
        <Box position="relative" w={`${contentWidth}px`}>
          <TimelineRuler
            lengthTicks={timeline.state.lengthTicks}
            pxPerTick={pxPerTick}
            onSeek={playback.seek}
          />
          <TimelineTrack
            markers={sortedMarkers}
            lengthTicks={timeline.state.lengthTicks}
            pxPerTick={pxPerTick}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onMoveMarker={timeline.moveMarker}
            onAddMarker={handleAddAtTick}
          />
          <TimelinePlayhead
            currentTick={playback.currentTick}
            pxPerTick={pxPerTick}
            heightPx={trackAreaHeight}
          />
        </Box>
      </Box>
    </Box>
  )
}
