// src/web/Sub/components/TimelineEditor.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box } from '@yamada-ui/react'
import type { Marker } from '../types/timeline'
import { useTimeline } from '../hooks/useTimeline'
import { useAudioBufferCache } from '../hooks/useAudioBufferCache'
import { useTimelinePlayback } from '../hooks/useTimelinePlayback'
import { DEFAULT_PX_PER_TICK, tickToPx } from '../utils/tickPixel'
import { parse, serialize } from '../utils/timelineIO'
import { TimelineToolbar } from './TimelineToolbar'
import { TimelineRuler } from './TimelineRuler'
import { TimelineTrack, SelectModifiers } from './TimelineTrack'
import { TimelinePlayhead } from './TimelinePlayhead'
import { useAudioLibrary } from '../../../hooks/useAudioLibrary'
import { TimelinePropertyPanel } from './TimelinePropertyPanel'

interface Props {
  defaultSoundId?: string
  currentTargetVersion?: string
}

interface ClipboardItem {
  tickOffset: number
  data: Omit<Marker, 'id' | 'tick'>
}

export const TimelineEditor: React.FC<Props> = ({ defaultSoundId, currentTargetVersion }) => {
  const timeline = useTimeline()
  const { soundIdList, soundMap } = useAudioLibrary()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const anchorRef = useRef<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const clipboardRef = useRef<ClipboardItem[]>([])
  const cache = useAudioBufferCache()
  const [subVolume, setSubVolume] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem('sub.volume') ?? '1')
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
  })
  const [subMuted, setSubMuted] = useState<boolean>(() => localStorage.getItem('sub.muted') === '1')
  useEffect(() => { localStorage.setItem('sub.volume', String(subVolume)) }, [subVolume])
  useEffect(() => { localStorage.setItem('sub.muted', subMuted ? '1' : '0') }, [subMuted])
  const playback = useTimelinePlayback({
    markers: timeline.state.markers,
    lengthTicks: timeline.state.lengthTicks,
    cache,
    masterVolume: subMuted ? 0 : subVolume,
  })
  const pxPerTick = DEFAULT_PX_PER_TICK
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // state 変更でダーティ化（初回マウント時は無視、Open/Save 直後は skipDirtyRef で 1 回だけ抑止）
  const firstRenderRef = useRef(true)
  const skipDirtyRef = useRef(false)
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return }
    if (skipDirtyRef.current) { skipDirtyRef.current = false; return }
    setDirty(true)
  }, [timeline.state])

  // SubApp の設定読込は非同期なので、空の新規プロジェクトに限って保存対象バージョンを補完する。
  useEffect(() => {
    if (!currentTargetVersion || timeline.state.targetVersion || filePath) return
    skipDirtyRef.current = true
    timeline.setTargetVersion(currentTargetVersion)
  }, [currentTargetVersion, filePath, timeline])

  // ウィンドウタイトルに未保存マーク * を反映
  useEffect(() => {
    const name = filePath ? filePath.replace(/^.*[\\\/]/, '') : '(未保存)'
    document.title = `${dirty ? '* ' : ''}Knead - ${name}`
  }, [dirty, filePath])

  // マーカー配列変化のたびにキャッシュを再プリロード（soundId の集合が実際に変わった時だけ） (M11)
  const preloadKeyRef = useRef<string>('')
  useEffect(() => {
    const ids = Array.from(new Set(timeline.state.markers.map(m => m.soundId).filter(Boolean))).sort()
    const key = ids.join('|')
    if (key === preloadKeyRef.current) return
    preloadKeyRef.current = key
    cache.preload(ids).catch(err => console.error('preload failed', err))
  }, [timeline.state.markers, cache])

  const handleAddAtTick = useCallback((tick: number) => {
    const id = timeline.addMarker({ tick, soundId: defaultSoundId ?? '' })
    setSelectedIds(new Set([id]))
    anchorRef.current = id
  }, [timeline, defaultSoundId])

  const handleAddAtPlayhead = useCallback(() => {
    handleAddAtTick(Math.round(playback.currentTick))
  }, [handleAddAtTick, playback.currentTick])

  const sortedMarkers = useMemo(
    () => [...timeline.state.markers].sort((a, b) => a.tick - b.tick),
    [timeline.state.markers],
  )
  const validSoundIds = useMemo(() => new Set(soundIdList), [soundIdList])

  const handleMarkerClick = useCallback((id: string, mods: SelectModifiers) => {
    setSelectedIds((prev) => {
      if (mods.ctrl) {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        anchorRef.current = id
        return next
      }
      if (mods.shift && anchorRef.current) {
        const anchor = anchorRef.current
        const idxA = sortedMarkers.findIndex(m => m.id === anchor)
        const idxB = sortedMarkers.findIndex(m => m.id === id)
        if (idxA < 0 || idxB < 0) return new Set([id])
        const [lo, hi] = idxA < idxB ? [idxA, idxB] : [idxB, idxA]
        const next = new Set(prev)
        for (let i = lo; i <= hi; i++) next.add(sortedMarkers[i].id)
        return next
      }
      anchorRef.current = id
      return new Set([id])
    })
  }, [sortedMarkers])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
    anchorRef.current = null
  }, [])

  const handleRectangleSelect = useCallback((ids: string[], mods: SelectModifiers) => {
    setSelectedIds((prev) => {
      if (mods.ctrl) {
        const next = new Set(prev)
        for (const id of ids) next.add(id)
        if (ids.length > 0) anchorRef.current = ids[ids.length - 1]
        return next
      }
      if (ids.length > 0) anchorRef.current = ids[ids.length - 1]
      return new Set(ids)
    })
  }, [])

  const handleBeginMove = useCallback(() => {
    timeline.beginTransaction()
  }, [timeline])

  const handleMoveMarkers = useCallback((deltas: Map<string, number>) => {
    timeline.moveMarkers(deltas)
  }, [timeline])

  const handleEndMove = useCallback(() => {
    timeline.commitTransaction()
  }, [timeline])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return
    timeline.removeMarkers(Array.from(selectedIds))
    setSelectedIds(new Set())
    anchorRef.current = null
  }, [selectedIds, timeline])

  const handleCopy = useCallback(() => {
    const selected = timeline.state.markers.filter(m => selectedIds.has(m.id))
    if (selected.length === 0) return
    const minTick = Math.min(...selected.map(m => m.tick))
    clipboardRef.current = selected.map(({ id: _id, tick, ...rest }) => ({
      tickOffset: tick - minTick,
      data: rest,
    }))
  }, [selectedIds, timeline.state.markers])

  const handlePaste = useCallback(() => {
    if (clipboardRef.current.length === 0) return
    const baseTick = Math.round(playback.currentTick)
    const additions = clipboardRef.current.map(c => ({
      tick: baseTick + c.tickOffset,
      ...c.data,
    }))
    const ids = timeline.addMarkers(additions)
    setSelectedIds(new Set(ids))
    anchorRef.current = ids[ids.length - 1] ?? null
  }, [playback.currentTick, timeline])

  const confirmDiscardIfDirty = useCallback((): boolean => {
    if (!dirty) return true
    return window.confirm('未保存の変更があります。破棄しますか？')
  }, [dirty])

  const handleOpen = useCallback(async () => {
    if (!confirmDiscardIfDirty()) return
    const res = await window.myAPI.timeline.openDialog()
    if (!res.ok) {
      if ('canceled' in res) return
      window.alert(`読込エラー: ${res.error}`)
      return
    }
    const parsed = parse(res.json)
    if (!parsed.ok) {
      window.alert(`読込エラー: ${parsed.error}`)
      return
    }
    skipDirtyRef.current = true
    timeline.replaceAll(parsed.state)
    setFilePath(res.path)
    setSelectedIds(new Set())
    anchorRef.current = null
    setDirty(false)
    const warnings = [...parsed.warnings]
    if (currentTargetVersion && parsed.state.targetVersion !== currentTargetVersion) {
      warnings.push(`このプロジェクトは Minecraft ${parsed.state.targetVersion || '(未指定)'} 用です。現在の選択は ${currentTargetVersion} です。`)
    }
    const missingSoundIds = Array.from(new Set(
      parsed.state.markers
        .map(marker => marker.soundId)
        .filter(soundId => soundId && !soundMap[soundId]),
    ))
    if (missingSoundIds.length > 0) {
      warnings.push(`現在のバージョンに存在しない soundId: ${missingSoundIds.join(', ')}`)
    }
    if (warnings.length > 0) window.alert(`警告:\n${warnings.join('\n')}`)
  }, [timeline, confirmDiscardIfDirty, currentTargetVersion, soundMap])

  const handleSaveAs = useCallback(async () => {
    const json = serialize(timeline.state)
    const res = await window.myAPI.timeline.saveDialog(filePath ?? 'timeline.kp', json)
    if (!res.ok) {
      if ('canceled' in res) return
      window.alert(`保存エラー: ${res.error}`)
      return
    }
    setFilePath(res.path)
    setDirty(false)
  }, [timeline.state, filePath])

  const handleSave = useCallback(async () => {
    if (!filePath) {
      await handleSaveAs()
      return
    }
    const res = await window.myAPI.timeline.save(serialize(timeline.state))
    if (!res.ok) {
      window.alert(`保存エラー: ${res.error}`)
      return
    }
    setDirty(false)
  }, [filePath, handleSaveAs, timeline.state])

  // キーボードショートカット
  const latestRef = useRef({
    selectedIds,
    markers: timeline.state.markers,
    handleDeleteSelected,
    handleCopy,
    handlePaste,
    undo: timeline.undo,
    redo: timeline.redo,
    playback,
  })
  latestRef.current = {
    selectedIds,
    markers: timeline.state.markers,
    handleDeleteSelected,
    handleCopy,
    handlePaste,
    undo: timeline.undo,
    redo: timeline.redo,
    playback,
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'BUTTON'
        || target.isContentEditable
      ) return
      const {
        selectedIds, markers, handleDeleteSelected,
        handleCopy, handlePaste, undo, redo, playback,
      } = latestRef.current
      const mod = e.ctrlKey || e.metaKey
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) { e.preventDefault(); handleDeleteSelected() }
      }
      else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelectedIds(new Set(markers.map(m => m.id)))
        anchorRef.current = markers[markers.length - 1]?.id ?? null
      }
      else if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        handleCopy()
      }
      else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        handlePaste()
      }
      else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      }
      else if ((mod && e.shiftKey && e.key.toLowerCase() === 'z') || (mod && e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        redo()
      }
      else if (e.key === 'Escape') {
        setSelectedIds(new Set())
        anchorRef.current = null
      }
      else if (e.key === ' ') {
        e.preventDefault()
        if (playback.isPlaying) playback.pause()
        else if (playback.isPaused) playback.resume()
        else playback.play()
      }
      else if (e.key === 'Home') {
        e.preventDefault()
        playback.seek(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 再生中はプレイヘッドが常に見えるようスクロール追従
  useEffect(() => {
    if (!playback.isPlaying) return
    const el = scrollRef.current
    if (!el) return
    const playheadPx = tickToPx(playback.currentTick, pxPerTick)
    const margin = 40
    if (playheadPx < el.scrollLeft + margin) {
      el.scrollLeft = Math.max(0, playheadPx - margin)
    }
    else if (playheadPx > el.scrollLeft + el.clientWidth - margin) {
      el.scrollLeft = playheadPx - el.clientWidth + margin
    }
  }, [playback.currentTick, playback.isPlaying, pxPerTick])

  const singleSelectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null
  const singleSelected = singleSelectedId
    ? timeline.state.markers.find(m => m.id === singleSelectedId) ?? null
    : null
  const selectedMarkers = useMemo(
    () => timeline.state.markers.filter(m => selectedIds.has(m.id)),
    [timeline.state.markers, selectedIds],
  )
  const commonVariantSoundId = useMemo(() => {
    if (selectedMarkers.length === 0) return null
    const first = selectedMarkers[0].soundId
    return selectedMarkers.every(m => m.soundId === first) ? first : null
  }, [selectedMarkers])
  const variants = commonVariantSoundId !== null ? (soundMap[commonVariantSoundId] ?? []) : []
  const handlePanelChange = useCallback((patch: Partial<Marker>) => {
    if (selectedIds.size === 0) return
    timeline.updateMarkers(Array.from(selectedIds), patch)
  }, [selectedIds, timeline])

  const handleShiftTick = useCallback((delta: number) => {
    if (selectedIds.size === 0 || delta === 0) return
    const selMarkers = timeline.state.markers.filter(m => selectedIds.has(m.id))
    if (selMarkers.length === 0) return
    const maxTick = Math.max(0, timeline.state.lengthTicks - 1)
    const minCur = Math.min(...selMarkers.map(m => m.tick))
    const maxCur = Math.max(...selMarkers.map(m => m.tick))
    const clamped = Math.max(-minCur, Math.min(delta, maxTick - maxCur))
    if (clamped === 0) return
    const deltas = new Map<string, number>()
    for (const m of selMarkers) deltas.set(m.id, m.tick + clamped)
    timeline.moveMarkers(deltas)
  }, [selectedIds, timeline])

  const contentWidth = tickToPx(timeline.state.lengthTicks, pxPerTick)
  const trackAreaHeight = 24 + 64

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
        onTogglePlay={() => {
          if (playback.isPlaying) playback.pause()
          else if (playback.isPaused) playback.resume()
          else playback.play()
        }}
        onStop={() => playback.stop()}
        isPlaying={playback.isPlaying}
        currentTick={playback.currentTick}
        preloading={cache.preloading}
        onUndo={timeline.undo}
        onRedo={timeline.redo}
        canUndo={timeline.canUndo}
        canRedo={timeline.canRedo}
        volume={subVolume}
        muted={subMuted}
        onChangeVolume={setSubVolume}
        onToggleMute={() => setSubMuted(m => !m)}
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
            validSoundIds={validSoundIds}
            lengthTicks={timeline.state.lengthTicks}
            pxPerTick={pxPerTick}
            selectedIds={selectedIds}
            onMarkerClick={handleMarkerClick}
            onClearSelection={handleClearSelection}
            onRectangleSelect={handleRectangleSelect}
            onBeginMove={handleBeginMove}
            onMoveMarkers={handleMoveMarkers}
            onEndMove={handleEndMove}
            onAddMarker={handleAddAtTick}
          />
          <TimelinePlayhead
            currentTick={playback.currentTick}
            pxPerTick={pxPerTick}
            heightPx={trackAreaHeight}
          />
        </Box>
      </Box>
      <TimelinePropertyPanel
        marker={singleSelected}
        selectionCount={selectedIds.size}
        selectedMarkers={selectedMarkers}
        lengthTicks={timeline.state.lengthTicks}
        soundIdList={soundIdList}
        variants={variants}
        onChange={handlePanelChange}
        onShiftTick={handleShiftTick}
      />
    </Box>
  )
}
