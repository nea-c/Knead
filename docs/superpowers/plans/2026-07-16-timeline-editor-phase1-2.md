# Timeline Editor Phase 1 + 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サブウィンドウの `AudioControlWindow`（サウンドグループ一覧）を、tick 単位のタイムライン上にマーカーを置いて再生するエディタへ段階的に置き換える。Phase 1 で静的マーカー編集を、Phase 2 でプレイヘッド走査再生と `.kp` ファイルの保存/読込までを完成させる。

**Architecture:** サブウィンドウ内は React state + immer で完結（Redux は使わない）。再生は Web Audio API の `AudioContext.currentTime` を絶対基準にした先読みスケジューラで実装。ファイル IO は Electron メインプロセス側の `ipcMain.handle` に集約し、レンダラは JSON 文字列だけを扱う。

**Tech Stack:** React 18 + TypeScript / Yamada UI (`@yamada-ui/react`) / Web Audio API / Electron 33 / uuid v11 / immer（要追加）

## Global Constraints

- 時間単位は 1 tick = 1/20 秒 = 50ms、`Tick = number`（整数）。全ての時刻・区間はこの単位。
- タイムラインは **シングルレーン**（レーン概念を導入しない）。
- マーカーは **単発トリガー**（`duration` フィールドは Phase 1・2 では型上のみ存在、UI 非露出）。
- 状態管理は Redux ではなく `useTimeline` フック内に閉じる。
- ファイル形式: 拡張子 `.kp`、中身は UTF-8 JSON、トップレベルに `format: "knead-project"`、`version: 1`。
- 既存の `AudioGroup.tsx` / `AudioControlWindow.tsx` は **Phase 2 完了時に削除**（Phase 1 中はトグルで共存）。
- テストフレームワークは今回導入しない（プロジェクトに既存なし）。純粋関数（`timelineIO` バリデータ、`tickPixel` 変換）は **ファイル末尾に単発 `runSelfCheck()` を書いて手動起動で検証**。UI はビルド後ブラウザで手動確認。
- コミット粒度: 各 Task 完了ごとに 1 コミット。メッセージは日本語、Prefix は `feat:` / `refactor:` / `chore:` を使用。

## File Structure

**新規作成:**
- `src/web/Sub/types/timeline.ts` — 型定義（Marker, Curve, Keyframe, TimelineState, TimelineFile）
- `src/web/Sub/utils/tickPixel.ts` — tick↔px 変換ヘルパ
- `src/web/Sub/utils/timelineIO.ts` — JSON シリアライズ / パース / バリデーション
- `src/web/Sub/hooks/useTimeline.ts` — 状態 + CRUD フック（Phase 1）
- `src/web/Sub/hooks/useAudioBufferCache.ts` — AudioBuffer プリロードキャッシュ（Phase 2）
- `src/web/Sub/hooks/useTimelinePlayback.ts` — プレイヘッド駆動再生エンジン（Phase 2）
- `src/web/Sub/components/TimelineEditor.tsx` — ルートコンテナ
- `src/web/Sub/components/TimelineToolbar.tsx` — 上部ツールバー
- `src/web/Sub/components/TimelineRuler.tsx` — tick 目盛り
- `src/web/Sub/components/TimelineTrack.tsx` — マーカー配置エリア
- `src/web/Sub/components/TimelineMarker.tsx` — 1 マーカー
- `src/web/Sub/components/TimelinePlayhead.tsx` — プレイヘッド縦線（Phase 2）

**変更:**
- `src/web/Sub/App.tsx` — Phase 1 でトグル追加、Phase 2 で旧 UI を削除して置換
- `src/preload.ts` — `myAPI.timeline.{saveDialog, openDialog}` を追加（Phase 2）
- `src/ipc-main-handler.ts` — `timeline:save-dialog` / `timeline:open-dialog` ハンドラ追加（Phase 2）
- `package.json` — `immer` を追加（Task 2）

**削除（Phase 2 末）:**
- `src/web/Sub/components/AudioGroup.tsx`
- `src/web/Sub/components/AudioControlWindow.tsx`

---

## Phase 1: 静的タイムライン + マーカー編集

### Task 1: 型定義

**Files:**
- Create: `src/web/Sub/types/timeline.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type Tick = number`
  - `interface Keyframe { tick: Tick; value: number; interpolation: 'linear' | 'bezier'; handleL?: { dt: number; dv: number }; handleR?: { dt: number; dv: number } }`
  - `interface Curve { keyframes: Keyframe[] }`
  - `interface Marker { id: string; tick: Tick; soundId: string; variantIndex: number; volume: number; pitch: number; duration?: Tick; retriggerInterval?: Tick; volumeCurve?: Curve; pitchCurve?: Curve }`
  - `interface TimelineState { targetVersion: string; lengthTicks: Tick; markers: Marker[] }`
  - `interface TimelineFile extends TimelineState { format: 'knead-project'; version: 1 }`
  - `const DEFAULT_TIMELINE_LENGTH_TICKS = 200`

- [ ] **Step 1: ファイル作成**

```ts
// src/web/Sub/types/timeline.ts

// 1 tick = 1/20 秒 = 50ms
export type Tick = number

export interface Keyframe {
  tick: Tick
  value: number
  interpolation: 'linear' | 'bezier'
  handleL?: { dt: number, dv: number }
  handleR?: { dt: number, dv: number }
}

export interface Curve {
  keyframes: Keyframe[]
}

export interface Marker {
  id: string
  tick: Tick
  soundId: string
  variantIndex: number
  volume: number
  pitch: number
  duration?: Tick
  retriggerInterval?: Tick
  volumeCurve?: Curve
  pitchCurve?: Curve
}

export interface TimelineState {
  targetVersion: string
  lengthTicks: Tick
  markers: Marker[]
}

export interface TimelineFile extends TimelineState {
  format: 'knead-project'
  version: 1
}

export const DEFAULT_TIMELINE_LENGTH_TICKS = 200
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: 変更ファイルに関するエラーなし（既存の未修正エラーは無視可）

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/types/timeline.ts
git commit -m "feat: タイムラインエディタの型定義を追加"
```

---

### Task 2: immer 追加 + useTimeline フック（CRUD）

**Files:**
- Modify: `package.json`
- Create: `src/web/Sub/hooks/useTimeline.ts`

**Interfaces:**
- Consumes: Task 1 の型
- Produces:
  - `function useTimeline(initial?: TimelineState): { state: TimelineState; addMarker: (partial: Partial<Marker> & { tick: Tick }) => string; removeMarker: (id: string) => void; moveMarker: (id: string, newTick: Tick) => void; updateMarker: (id: string, patch: Partial<Marker>) => void; setLength: (ticks: Tick) => void; setTargetVersion: (v: string) => void; replaceAll: (next: TimelineState) => void }`
  - `addMarker` は生成した id を返す

- [ ] **Step 1: immer をインストール**

Run: `npm install immer`
Expected: `added 1 package`

- [ ] **Step 2: フック実装**

```ts
// src/web/Sub/hooks/useTimeline.ts
import { useCallback, useState } from 'react'
import { produce } from 'immer'
import { v4 as uuidv4 } from 'uuid'
import type { Marker, Tick, TimelineState } from '../types/timeline'
import { DEFAULT_TIMELINE_LENGTH_TICKS } from '../types/timeline'

const defaultState = (): TimelineState => ({
  targetVersion: '',
  lengthTicks: DEFAULT_TIMELINE_LENGTH_TICKS,
  markers: [],
})

export function useTimeline(initial?: TimelineState) {
  const [state, setState] = useState<TimelineState>(initial ?? defaultState())

  const addMarker = useCallback(
    (partial: Partial<Marker> & { tick: Tick }): string => {
      const id = uuidv4()
      setState(produce((draft) => {
        draft.markers.push({
          id,
          tick: partial.tick,
          soundId: partial.soundId ?? '',
          variantIndex: partial.variantIndex ?? -1,
          volume: partial.volume ?? 1.0,
          pitch: partial.pitch ?? 1.0,
          duration: partial.duration,
          retriggerInterval: partial.retriggerInterval,
          volumeCurve: partial.volumeCurve,
          pitchCurve: partial.pitchCurve,
        })
      }))
      return id
    },
    [],
  )

  const removeMarker = useCallback((id: string) => {
    setState(produce((draft) => {
      draft.markers = draft.markers.filter(m => m.id !== id)
    }))
  }, [])

  const moveMarker = useCallback((id: string, newTick: Tick) => {
    setState(produce((draft) => {
      const m = draft.markers.find(m => m.id === id)
      if (m) m.tick = Math.max(0, Math.trunc(newTick))
    }))
  }, [])

  const updateMarker = useCallback((id: string, patch: Partial<Marker>) => {
    setState(produce((draft) => {
      const m = draft.markers.find(m => m.id === id)
      if (!m) return
      Object.assign(m, patch)
    }))
  }, [])

  const setLength = useCallback((ticks: Tick) => {
    setState(produce((draft) => { draft.lengthTicks = Math.max(1, Math.trunc(ticks)) }))
  }, [])

  const setTargetVersion = useCallback((v: string) => {
    setState(produce((draft) => { draft.targetVersion = v }))
  }, [])

  const replaceAll = useCallback((next: TimelineState) => {
    setState(next)
  }, [])

  return {
    state,
    addMarker,
    removeMarker,
    moveMarker,
    updateMarker,
    setLength,
    setTargetVersion,
    replaceAll,
  }
}
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: 新規ファイルにエラーなし

- [ ] **Step 4: コミット**

```bash
git add package.json package-lock.json src/web/Sub/hooks/useTimeline.ts
git commit -m "feat: useTimeline フック（マーカー CRUD）を追加"
```

---

### Task 3: tickPixel 変換ユーティリティ + セルフチェック

**Files:**
- Create: `src/web/Sub/utils/tickPixel.ts`

**Interfaces:**
- Consumes: `Tick`（Task 1）
- Produces:
  - `function tickToPx(tick: Tick, pxPerTick: number): number`（`Math.round(tick * pxPerTick)`）
  - `function pxToTick(px: number, pxPerTick: number): Tick`（`Math.round(px / pxPerTick)`。0 未満は 0 にクランプ）
  - `function snapPxToTick(px: number, pxPerTick: number): number`（`pxToTick` 経由で tick 境界に吸着した px）
  - `const DEFAULT_PX_PER_TICK = 8`

- [ ] **Step 1: 実装**

```ts
// src/web/Sub/utils/tickPixel.ts
import type { Tick } from '../types/timeline'

export const DEFAULT_PX_PER_TICK = 8

export function tickToPx(tick: Tick, pxPerTick: number): number {
  return Math.round(tick * pxPerTick)
}

export function pxToTick(px: number, pxPerTick: number): Tick {
  const t = Math.round(px / pxPerTick)
  return t < 0 ? 0 : t
}

export function snapPxToTick(px: number, pxPerTick: number): number {
  return tickToPx(pxToTick(px, pxPerTick), pxPerTick)
}

// 手動セルフチェック（ファイル末尾に追加、開発時のみ手で呼ぶ）
export function _selfCheckTickPixel(): void {
  const cases: Array<[number, number, number]> = [
    // [tick, pxPerTick, expectedPx]
    [0, 8, 0], [1, 8, 8], [10, 8, 80], [3, 4, 12],
  ]
  for (const [t, ppt, expected] of cases) {
    const got = tickToPx(t, ppt)
    if (got !== expected) throw new Error(`tickToPx(${t}, ${ppt}) => ${got}, expected ${expected}`)
  }
  const pxCases: Array<[number, number, number]> = [
    [0, 8, 0], [4, 8, 1], [7, 8, 1], [8, 8, 1], [12, 8, 2], [-5, 8, 0],
  ]
  for (const [px, ppt, expected] of pxCases) {
    const got = pxToTick(px, ppt)
    if (got !== expected) throw new Error(`pxToTick(${px}, ${ppt}) => ${got}, expected ${expected}`)
  }
  console.log('tickPixel self-check OK')
}
```

- [ ] **Step 2: セルフチェック実行**

Run: `npx ts-node -e "require('./src/web/Sub/utils/tickPixel')._selfCheckTickPixel()"`
Expected: `tickPixel self-check OK`

（もし `ts-node` パス解決で失敗する場合は Step 3 スキップして目視レビューでもよい）

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/web/Sub/utils/tickPixel.ts
git commit -m "feat: tick↔px 変換ユーティリティを追加"
```

---

### Task 4: TimelineMarker コンポーネント

**Files:**
- Create: `src/web/Sub/components/TimelineMarker.tsx`

**Interfaces:**
- Consumes: `Marker`（Task 1）、`tickToPx`（Task 3）
- Produces: React コンポーネント `<TimelineMarker>` — props:
  ```ts
  { marker: Marker; pxPerTick: number; selected: boolean; onPointerDown: (e: React.PointerEvent) => void }
  ```
  絶対配置された円形バッジを描画。`left = tickToPx(marker.tick, pxPerTick)`、選択中は色変え。

- [ ] **Step 1: 実装**

```tsx
// src/web/Sub/components/TimelineMarker.tsx
import React from 'react'
import { Box, Text } from '@yamada-ui/react'
import type { Marker } from '../types/timeline'
import { tickToPx } from '../utils/tickPixel'

interface Props {
  marker: Marker
  pxPerTick: number
  selected: boolean
  onPointerDown: (e: React.PointerEvent) => void
}

const MARKER_SIZE = 16

export const TimelineMarker: React.FC<Props> = ({ marker, pxPerTick, selected, onPointerDown }) => {
  const left = tickToPx(marker.tick, pxPerTick) - MARKER_SIZE / 2
  return (
    <Box
      position="absolute"
      left={`${left}px`}
      top="50%"
      transform="translateY(-50%)"
      w={`${MARKER_SIZE}px`}
      h={`${MARKER_SIZE}px`}
      borderRadius="full"
      bg={selected ? 'blue.400' : 'gray.300'}
      border="2px solid"
      borderColor={selected ? 'blue.200' : 'gray.500'}
      cursor="grab"
      onPointerDown={onPointerDown}
      title={`t=${marker.tick} ${marker.soundId || '(no sound)'}`}
    >
      {marker.soundId === '' && (
        <Text position="absolute" top="-14px" left="0" fontSize="10px" color="red.400">!</Text>
      )}
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/components/TimelineMarker.tsx
git commit -m "feat: TimelineMarker コンポーネントを追加"
```

---

### Task 5: TimelineRuler コンポーネント

**Files:**
- Create: `src/web/Sub/components/TimelineRuler.tsx`

**Interfaces:**
- Consumes: `tickToPx`（Task 3）
- Produces: React コンポーネント `<TimelineRuler>` — props:
  ```ts
  { lengthTicks: number; pxPerTick: number; onSeek?: (tick: number) => void }
  ```
  上部の tick 目盛り。10 tick ごとに数字、5 tick ごとに小目盛。`onSeek` が渡されている場合はクリックで tick を通知（Phase 2 で有効化、Phase 1 は不使用）。

- [ ] **Step 1: 実装**

```tsx
// src/web/Sub/components/TimelineRuler.tsx
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
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/components/TimelineRuler.tsx
git commit -m "feat: TimelineRuler（tick 目盛り）を追加"
```

---

### Task 6: TimelineTrack コンポーネント（マーカー配置エリア + ドラッグ）

**Files:**
- Create: `src/web/Sub/components/TimelineTrack.tsx`

**Interfaces:**
- Consumes: `Marker`（Task 1）、`tickToPx` / `pxToTick`（Task 3）、`TimelineMarker`（Task 4）
- Produces: React コンポーネント `<TimelineTrack>` — props:
  ```ts
  {
    markers: Marker[]
    lengthTicks: number
    pxPerTick: number
    selectedIds: Set<string>
    onSelect: (id: string | null) => void        // null = 選択解除
    onMoveMarker: (id: string, newTick: number) => void
    onAddMarker: (tick: number) => void          // ダブルクリック
  }
  ```
  マーカーのドラッグ移動と、空白ダブルクリックでの追加、空白シングルクリックでの選択解除を担当。

- [ ] **Step 1: 実装**

```tsx
// src/web/Sub/components/TimelineTrack.tsx
import React, { useCallback, useRef } from 'react'
import { Box } from '@yamada-ui/react'
import type { Marker } from '../types/timeline'
import { tickToPx, pxToTick } from '../utils/tickPixel'
import { TimelineMarker } from './TimelineMarker'

interface Props {
  markers: Marker[]
  lengthTicks: number
  pxPerTick: number
  selectedIds: Set<string>
  onSelect: (id: string | null) => void
  onMoveMarker: (id: string, newTick: number) => void
  onAddMarker: (tick: number) => void
}

const TRACK_HEIGHT = 64

export const TimelineTrack: React.FC<Props> = ({
  markers, lengthTicks, pxPerTick, selectedIds, onSelect, onMoveMarker, onAddMarker,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    id: string
    startTick: number
    startClientX: number
  } | null>(null)

  const totalPx = tickToPx(lengthTicks, pxPerTick)

  const handleMarkerPointerDown = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      e.stopPropagation()
      const m = markers.find(x => x.id === id)
      if (!m) return
      onSelect(id)
      dragStateRef.current = { id, startTick: m.tick, startClientX: e.clientX }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [markers, onSelect],
  )

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragStateRef.current
    if (!d) return
    const deltaPx = e.clientX - d.startClientX
    const deltaTick = pxToTick(Math.abs(deltaPx), pxPerTick) * (deltaPx < 0 ? -1 : 1)
    const newTick = Math.max(0, d.startTick + deltaTick)
    onMoveMarker(d.id, newTick)
  }, [pxPerTick, onMoveMarker])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStateRef.current) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      dragStateRef.current = null
    }
  }, [])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    // マーカー内をクリックした場合は onPointerDown 側で stopPropagation されているので、
    // ここに来るのは空白部分のクリックのみ
    if (e.detail === 2) return // ダブルクリックは別ハンドラ
    onSelect(null)
  }, [onSelect])

  const handleTrackDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    onAddMarker(pxToTick(x, pxPerTick))
  }, [pxPerTick, onAddMarker])

  return (
    <Box
      ref={trackRef}
      position="relative"
      w={`${totalPx}px`}
      h={`${TRACK_HEIGHT}px`}
      bg="gray.800"
      borderBottom="1px solid"
      borderColor="gray.700"
      onClick={handleTrackClick}
      onDoubleClick={handleTrackDoubleClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {markers.map(m => (
        <TimelineMarker
          key={m.id}
          marker={m}
          pxPerTick={pxPerTick}
          selected={selectedIds.has(m.id)}
          onPointerDown={handleMarkerPointerDown(m.id)}
        />
      ))}
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/components/TimelineTrack.tsx
git commit -m "feat: TimelineTrack（マーカーのドラッグ移動・追加）を追加"
```

---

### Task 7: TimelineToolbar（Phase 1 版：追加/削除ボタンのみ）

**Files:**
- Create: `src/web/Sub/components/TimelineToolbar.tsx`

**Interfaces:**
- Consumes: なし（Phase 2 で拡張予定）
- Produces: React コンポーネント `<TimelineToolbar>` — props:
  ```ts
  {
    onAddMarker: () => void
    onDeleteSelected: () => void
    canDelete: boolean
  }
  ```

- [ ] **Step 1: 実装**

```tsx
// src/web/Sub/components/TimelineToolbar.tsx
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
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/components/TimelineToolbar.tsx
git commit -m "feat: TimelineToolbar（Phase 1 最小版）を追加"
```

---

### Task 8: TimelineEditor ルートコンポーネント

**Files:**
- Create: `src/web/Sub/components/TimelineEditor.tsx`

**Interfaces:**
- Consumes: `useTimeline`（Task 2）、`DEFAULT_PX_PER_TICK`（Task 3）、`TimelineToolbar` / `TimelineRuler` / `TimelineTrack`（Task 5-7）、`Marker`（Task 1）
- Produces: React コンポーネント `<TimelineEditor>` — props:
  ```ts
  { defaultSoundId?: string }
  ```
  内部で `useTimeline` を持ち、選択状態（`Set<string>`）を管理し、キーボード `Delete` / `Backspace` で削除、`Ctrl/Cmd+A` で全選択、`Escape` で選択解除。

- [ ] **Step 1: 実装**

```tsx
// src/web/Sub/components/TimelineEditor.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Box } from '@yamada-ui/react'
import { useTimeline } from '../hooks/useTimeline'
import { DEFAULT_PX_PER_TICK } from '../utils/tickPixel'
import { TimelineToolbar } from './TimelineToolbar'
import { TimelineRuler } from './TimelineRuler'
import { TimelineTrack } from './TimelineTrack'

interface Props {
  defaultSoundId?: string
}

export const TimelineEditor: React.FC<Props> = ({ defaultSoundId }) => {
  const timeline = useTimeline()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const pxPerTick = DEFAULT_PX_PER_TICK

  const handleAddAtTick = useCallback((tick: number) => {
    const id = timeline.addMarker({ tick, soundId: defaultSoundId ?? '' })
    setSelectedIds(new Set([id]))
  }, [timeline, defaultSoundId])

  const handleAddAtStart = useCallback(() => {
    handleAddAtTick(0)
  }, [handleAddAtTick])

  const handleSelect = useCallback((id: string | null) => {
    setSelectedIds(id === null ? new Set() : new Set([id]))
  }, [])

  const handleDeleteSelected = useCallback(() => {
    for (const id of selectedIds) timeline.removeMarker(id)
    setSelectedIds(new Set())
  }, [selectedIds, timeline])

  // キーボードショートカット
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault()
          handleDeleteSelected()
        }
      }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        setSelectedIds(new Set(timeline.state.markers.map(m => m.id)))
      }
      else if (e.key === 'Escape') {
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, timeline.state.markers, handleDeleteSelected])

  const sortedMarkers = useMemo(
    () => [...timeline.state.markers].sort((a, b) => a.tick - b.tick),
    [timeline.state.markers],
  )

  return (
    <Box display="flex" flexDir="column" h="100vh" bg="gray.950">
      <TimelineToolbar
        onAddMarker={handleAddAtStart}
        onDeleteSelected={handleDeleteSelected}
        canDelete={selectedIds.size > 0}
      />
      <Box flex="1" overflow="auto">
        <TimelineRuler
          lengthTicks={timeline.state.lengthTicks}
          pxPerTick={pxPerTick}
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
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/components/TimelineEditor.tsx
git commit -m "feat: TimelineEditor ルートコンポーネントを追加"
```

---

### Task 9: サブ App.tsx にトグル追加（旧 UI と並存）

**Files:**
- Modify: `src/web/Sub/App.tsx`

**Interfaces:**
- Consumes: `TimelineEditor`（Task 8）、既存 `AudioControlWindow`
- Produces: サブウィンドウ上部にトグル `[グループ表示 / タイムライン]` を追加。デフォルトはタイムライン側。

- [ ] **Step 1: 差し替え**

置換前:

```tsx
// src/web/Sub/App.tsx（末尾付近）
  return (
    <AudioControlWindow mainSelectedId={mainSelectedId} />
  )
}
```

置換後:

```tsx
// src/web/Sub/App.tsx
import React, { useEffect, useState } from 'react'
import { Box, Flex, Button } from '@yamada-ui/react'
import { useAddDispatch, useAppSelector } from '../../store/_store'
import { updateSoundList, updateTargetVersion } from '../../store/fetchSlice'
import { AudioControlWindow } from './components/AudioControlWindow'
import { TimelineEditor } from './components/TimelineEditor'
import { VersionInfoType } from '../../types/VersionInfo'

export const SubApp = () => {
  const dispatch = useAddDispatch()
  const targetVersion = useAppSelector(s => s.fetch.targetVersion)
  const sounds = useAppSelector(s => s.fetch.sounds)
  const selectedSound = useAppSelector(s => s.fetch.selectedSound)

  useEffect(() => {
    ;(async () => {
      const version = await window.myAPI.getSetting('selectedVersion')
      if (version) dispatch(updateTargetVersion({ targetVersion: version as VersionInfoType }))
    })()
  }, [dispatch])

  useEffect(() => {
    if (!targetVersion) return
    ;(async () => {
      const list = await window.myAPI.get_mcSounds(targetVersion.raw)
      dispatch(updateSoundList({ sounds: list }))
    })()
  }, [dispatch, targetVersion])

  useEffect(() => {
    ;(async () => {
      const list = await window.myAPI.getCurrentSounds()
      if (Array.isArray(list)) dispatch(updateSoundList({ sounds: list }))
    })()
  }, [dispatch])

  const [mainSelectedId, setMainSelectedId] = useState<string>('')
  useEffect(() => {
    const fetchMainSelectedId = async () => {
      const id = await window.myAPI.getMainSelectedSound()
      setMainSelectedId(id)
    }
    fetchMainSelectedId()
    const interval = setInterval(fetchMainSelectedId, 1000)
    return () => clearInterval(interval)
  }, [])

  const [mode, setMode] = useState<'group' | 'timeline'>('timeline')

  return (
    <Box display="flex" flexDir="column" h="100vh">
      <Flex bg="gray.900" p="1" gap="1" borderBottom="1px solid" borderColor="gray.700">
        <Button size="xs" colorScheme={mode === 'timeline' ? 'blue' : 'gray'} onClick={() => setMode('timeline')}>タイムライン</Button>
        <Button size="xs" colorScheme={mode === 'group' ? 'blue' : 'gray'} onClick={() => setMode('group')}>グループ (旧)</Button>
      </Flex>
      <Box flex="1" overflow="hidden">
        {mode === 'timeline'
          ? <TimelineEditor defaultSoundId={mainSelectedId} />
          : <AudioControlWindow mainSelectedId={mainSelectedId} />}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/App.tsx
git commit -m "feat: サブウィンドウに旧グループ/新タイムラインのトグルを追加"
```

---

### Task 10: Phase 1 手動検証

**Files:**
- （検証のみ、コミットなし）

- [ ] **Step 1: ビルド起動**

Run: `npm run dev`
Expected: エラーなく Electron が立ち上がる

- [ ] **Step 2: サブウィンドウを開く**

- メインウィンドウのサブウィンドウを開くボタンをクリック
- 上部トグルが「タイムライン / グループ (旧)」で表示、タイムラインがアクティブ
- Ruler の目盛りが 0..200 まで表示、10 tick 毎に数字

- [ ] **Step 3: マーカー操作を確認**

- 「+ マーカー追加」ボタン → t=0 にマーカーが出現、選択済み色
- Track の空白部を **ダブルクリック** → クリック位置の tick にマーカー出現
- マーカーをドラッグ → 左右に移動、tick スナップ
- マーカークリック → 選択（青）
- 空白シングルクリック → 選択解除
- `Delete` キー → 選択中マーカー削除
- `Ctrl+A` → 全マーカー選択、`Delete` で全削除
- `Escape` → 選択解除

- [ ] **Step 4: トグル切替**

- 「グループ (旧)」に切替 → 既存の `AudioControlWindow` UI が変わらず動く
- 「タイムライン」に戻す → タイムラインの状態が保持されている（同じ React インスタンス）

- [ ] **Step 5: 何か不具合があれば個別コミットで修正**

Phase 1 の目視動作が問題なければ次に進む。

---

## Phase 2: 再生エンジン + `.kp` 永続化

### Task 11: Electron メインプロセスに保存/読込 IPC ハンドラを追加

**Files:**
- Modify: `src/ipc-main-handler.ts`

**Interfaces:**
- Consumes: Electron `ipcMain`, `dialog`
- Produces:
  - `ipcMain.handle('timeline:save-dialog', (_e, defaultPath: string | undefined, json: string) => Promise<string | null>)` — 保存ダイアログを開き、確定なら保存パスを返す。キャンセルなら `null`
  - `ipcMain.handle('timeline:open-dialog', () => Promise<{ path: string, json: string } | null>)` — 開くダイアログ。キャンセルなら `null`

- [ ] **Step 1: import 追加**

`src/ipc-main-handler.ts` の先頭 import 群を以下に置換:

```ts
import { Dict } from '@yamada-ui/react'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { Sound } from './store/fetchSlice'
import { loadSettings, saveSettings, loadRatingStar, saveRatingStar, updateRatingStar, saveRatingStarAsString } from './config'
```

- [ ] **Step 2: `initIpcMain` 関数の末尾（最後の `ipcMain.handle('get_main_selected_sound', ...)` の直後、閉じ `}` の直前）にハンドラ追加**

```ts
  ipcMain.handle(
    'timeline:save-dialog',
    async (event, defaultPath: string | undefined, json: string): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const result = await dialog.showSaveDialog(win!, {
        title: 'Knead Project を保存',
        defaultPath: defaultPath ?? 'timeline.kp',
        filters: [{ name: 'Knead Project', extensions: ['kp'] }],
      })
      if (result.canceled || !result.filePath) return null
      await fs.promises.writeFile(result.filePath, json, 'utf-8')
      return result.filePath
    },
  )

  ipcMain.handle(
    'timeline:open-dialog',
    async (event): Promise<{ path: string, json: string } | null> => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const result = await dialog.showOpenDialog(win!, {
        title: 'Knead Project を開く',
        properties: ['openFile'],
        filters: [{ name: 'Knead Project', extensions: ['kp'] }],
      })
      if (result.canceled || result.filePaths.length === 0) return null
      const filePath = result.filePaths[0]
      const json = await fs.promises.readFile(filePath, 'utf-8')
      return { path: filePath, json }
    },
  )
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/ipc-main-handler.ts
git commit -m "feat: タイムライン保存/読込ダイアログの IPC ハンドラを追加"
```

---

### Task 12: preload に `myAPI.timeline` を追加

**Files:**
- Modify: `src/preload.ts`
- Modify: `@types/global.d.ts`（既存の `Sandbox` インターフェースに `timeline` を追加）

**Interfaces:**
- Consumes: `contextBridge`, `ipcRenderer`
- Produces:
  - `window.myAPI.timeline.saveDialog(defaultPath: string | undefined, json: string): Promise<string | null>`
  - `window.myAPI.timeline.openDialog(): Promise<{ path: string, json: string } | null>`

- [ ] **Step 1: 全面置換**

```ts
// src/preload.ts
console.log('preloaded!')

import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('myAPI', {
  get_versions: () => ipcRenderer.invoke('get_versions'),
  get_mcSounds: (version: string) => ipcRenderer.invoke('get_mcSounds', version),
  get_mcSoundHash: (hash: string) => ipcRenderer.invoke('get_mcSoundHash', hash),
  make_sub_window: () => ipcRenderer.invoke('make_sub_window'),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  updateSettings: (partial: string | number | boolean) => ipcRenderer.send('settings:update', partial),
  getSetting: (key: string): Promise<string | number | boolean> => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string | number | boolean) => ipcRenderer.send('settings:set', { key, value }),
  loadRatingStar: async (): Promise<{ [key: string]: number }> => { return await ipcRenderer.invoke('load-rating-star') },
  saveRatingStar: async (data: string): Promise<void> => { await ipcRenderer.invoke('save-rating-star', data) },
  saveRatingStarAsString: async (data: string): Promise<void> => { await ipcRenderer.invoke('save-rating-star-as-string', data) },
  updateRatingStar: async (key: string, value: number): Promise<void> => { await ipcRenderer.invoke('update-rating-star', key, value) },
  getCurrentSounds: () => ipcRenderer.invoke('getCurrentSounds'),
  getMainSelectedSound: () => ipcRenderer.invoke('get_main_selected_sound'),
  setSelectedSound: (id: string) => ipcRenderer.send('set_selected_sound', id),
  timeline: {
    saveDialog: (defaultPath: string | undefined, json: string): Promise<string | null> =>
      ipcRenderer.invoke('timeline:save-dialog', defaultPath, json),
    openDialog: (): Promise<{ path: string, json: string } | null> =>
      ipcRenderer.invoke('timeline:open-dialog'),
  },
})
```

- [ ] **Step 2: `@types/global.d.ts` の `Sandbox` インターフェースに timeline を追加**

`@types/global.d.ts` の `Sandbox` インターフェース末尾（`getMainSelectedSound` の後）に以下を追加:

```ts
  timeline: {
    saveDialog: (defaultPath: string | undefined, json: string) => Promise<string | null>
    openDialog: () => Promise<{ path: string, json: string } | null>
  }
```

追加後の該当箇所は以下のようになる（変更行のみ抜粋）:

```ts
export interface Sandbox {
  // ... 既存プロパティ ...
  getMainSelectedSound: () => Promise<string>
  timeline: {
    saveDialog: (defaultPath: string | undefined, json: string) => Promise<string | null>
    openDialog: () => Promise<{ path: string, json: string } | null>
  }
}
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし。もし既存の型宣言との衝突があれば、そちらを timeline 対応に更新して解決。

- [ ] **Step 4: コミット**

```bash
git add src/preload.ts @types/global.d.ts
git commit -m "feat: preload に myAPI.timeline (save/open) を追加"
```

---

### Task 13: `timelineIO` — シリアライズ + パース + バリデーション

**Files:**
- Create: `src/web/Sub/utils/timelineIO.ts`

**Interfaces:**
- Consumes: `TimelineState`, `TimelineFile`, `Marker`, `Keyframe`（Task 1）
- Produces:
  - `function serialize(state: TimelineState): string` — JSON 文字列（インデント 2）
  - `type ParseResult = { ok: true; state: TimelineState; warnings: string[] } | { ok: false; error: string }`
  - `function parse(json: string): ParseResult`
  - `function _selfCheckTimelineIO(): void` — ファイル末尾のセルフチェック

- [ ] **Step 1: 実装**

```ts
// src/web/Sub/utils/timelineIO.ts
import type { Keyframe, Marker, TimelineFile, TimelineState } from '../types/timeline'

export function serialize(state: TimelineState): string {
  const file: TimelineFile = {
    format: 'knead-project',
    version: 1,
    targetVersion: state.targetVersion,
    lengthTicks: state.lengthTicks,
    markers: state.markers,
  }
  return JSON.stringify(file, null, 2)
}

export type ParseResult =
  | { ok: true, state: TimelineState, warnings: string[] }
  | { ok: false, error: string }

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function validateKeyframe(x: unknown): x is Keyframe {
  if (!isObj(x)) return false
  if (typeof x.tick !== 'number' || !Number.isFinite(x.tick)) return false
  if (typeof x.value !== 'number' || !Number.isFinite(x.value)) return false
  if (x.interpolation !== 'linear' && x.interpolation !== 'bezier') return false
  return true
}

function validateMarker(x: unknown, warnings: string[]): x is Marker {
  if (!isObj(x)) return false
  if (typeof x.id !== 'string' || x.id.length === 0) return false
  if (typeof x.tick !== 'number' || !Number.isInteger(x.tick) || x.tick < 0) return false
  if (typeof x.soundId !== 'string') return false
  if (typeof x.variantIndex !== 'number' || !Number.isInteger(x.variantIndex)) return false
  if (typeof x.volume !== 'number' || !Number.isFinite(x.volume)) return false
  if (typeof x.pitch !== 'number' || !Number.isFinite(x.pitch)) return false
  if (x.duration !== undefined && (typeof x.duration !== 'number' || !Number.isInteger(x.duration) || x.duration < 0)) return false
  if (x.retriggerInterval !== undefined && (typeof x.retriggerInterval !== 'number' || !Number.isInteger(x.retriggerInterval) || x.retriggerInterval <= 0)) return false
  if (x.volumeCurve !== undefined) {
    if (!isObj(x.volumeCurve) || !Array.isArray(x.volumeCurve.keyframes)) return false
    if (!x.volumeCurve.keyframes.every(validateKeyframe)) return false
  }
  if (x.pitchCurve !== undefined) {
    if (!isObj(x.pitchCurve) || !Array.isArray(x.pitchCurve.keyframes)) return false
    if (!x.pitchCurve.keyframes.every(validateKeyframe)) return false
  }
  return true
}

export function parse(json: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  }
  catch (e) {
    return { ok: false, error: `JSON パース失敗: ${(e as Error).message}` }
  }
  if (!isObj(raw)) return { ok: false, error: 'ルートがオブジェクトではありません' }
  if (raw.format !== 'knead-project') return { ok: false, error: `format が 'knead-project' ではありません (got: ${JSON.stringify(raw.format)})` }
  if (raw.version !== 1) return { ok: false, error: `version ${JSON.stringify(raw.version)} は未対応です (対応: 1)` }
  if (typeof raw.targetVersion !== 'string') return { ok: false, error: 'targetVersion が文字列ではありません' }
  if (typeof raw.lengthTicks !== 'number' || !Number.isInteger(raw.lengthTicks) || raw.lengthTicks < 1) return { ok: false, error: 'lengthTicks が正の整数ではありません' }
  if (!Array.isArray(raw.markers)) return { ok: false, error: 'markers が配列ではありません' }

  const warnings: string[] = []
  const validMarkers: Marker[] = []
  raw.markers.forEach((m: unknown, i: number) => {
    if (validateMarker(m, warnings)) {
      validMarkers.push(m)
    }
    else {
      warnings.push(`markers[${i}] が不正なため除外`)
    }
  })

  return {
    ok: true,
    state: {
      targetVersion: raw.targetVersion,
      lengthTicks: raw.lengthTicks,
      markers: validMarkers,
    },
    warnings,
  }
}

export function _selfCheckTimelineIO(): void {
  // 往復テスト
  const state: TimelineState = {
    targetVersion: '1.21.4',
    lengthTicks: 100,
    markers: [
      { id: 'a', tick: 10, soundId: 'block.note_block.pling', variantIndex: -1, volume: 1, pitch: 1 },
      { id: 'b', tick: 50, soundId: 'ambient.cave', variantIndex: 0, volume: 0.5, pitch: 1.5, duration: 20, retriggerInterval: 5 },
    ],
  }
  const json = serialize(state)
  const result = parse(json)
  if (!result.ok) throw new Error(`往復パース失敗: ${result.error}`)
  if (result.state.markers.length !== 2) throw new Error(`marker 数不一致`)
  if (result.state.markers[1].duration !== 20) throw new Error(`duration 消失`)

  // format 違い拒否
  const badFormat = parse(JSON.stringify({ format: 'other', version: 1, targetVersion: '', lengthTicks: 1, markers: [] }))
  if (badFormat.ok) throw new Error(`format 違いを受け入れてしまった`)

  // version 拒否
  const badVer = parse(JSON.stringify({ format: 'knead-project', version: 2, targetVersion: '', lengthTicks: 1, markers: [] }))
  if (badVer.ok) throw new Error(`version 2 を受け入れてしまった`)

  // 壊れた marker はスキップ扱い
  const withBad = parse(JSON.stringify({
    format: 'knead-project', version: 1, targetVersion: '', lengthTicks: 100,
    markers: [
      { id: 'ok', tick: 0, soundId: '', variantIndex: -1, volume: 1, pitch: 1 },
      { id: 'bad', tick: -5, soundId: '', variantIndex: -1, volume: 1, pitch: 1 }, // tick 負
    ],
  }))
  if (!withBad.ok) throw new Error(`部分不正で全体を落としてしまった: ${withBad.error}`)
  if (withBad.state.markers.length !== 1) throw new Error(`不正マーカーを除外していない`)
  if (withBad.warnings.length !== 1) throw new Error(`warning が出ていない`)

  console.log('timelineIO self-check OK')
}
```

- [ ] **Step 2: セルフチェック実行**

Run: `npx ts-node -e "require('./src/web/Sub/utils/timelineIO')._selfCheckTimelineIO()"`
Expected: `timelineIO self-check OK`

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/web/Sub/utils/timelineIO.ts
git commit -m "feat: timelineIO（シリアライズ/パース/バリデーション）を追加"
```

---

### Task 14: TimelineToolbar 拡張（開く/保存/名前を付けて保存 + 未保存フラグ）

**Files:**
- Modify: `src/web/Sub/components/TimelineToolbar.tsx`

**Interfaces:**
- Consumes: なし（React state 経由）
- Produces: `<TimelineToolbar>` の props を以下に拡張:
  ```ts
  {
    onAddMarker: () => void
    onDeleteSelected: () => void
    canDelete: boolean
    onOpen: () => void
    onSave: () => void
    onSaveAs: () => void
    dirty: boolean
    filePath: string | null
    // Phase 2 で追加
    onTogglePlay: () => void
    onStop: () => void
    isPlaying: boolean
  }
  ```

- [ ] **Step 1: 全面置換**

```tsx
// src/web/Sub/components/TimelineToolbar.tsx
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
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: `TimelineEditor` から旧 props で呼んでいるためエラーが出る。次の Task 15 で修正するので、この Task ではこのままコミット。

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/components/TimelineToolbar.tsx
git commit -m "feat: TimelineToolbar に開く/保存/再生ボタンと未保存表示を追加"
```

---

### Task 15: useAudioBufferCache フック

**Files:**
- Create: `src/web/Sub/hooks/useAudioBufferCache.ts`

**Interfaces:**
- Consumes: 既存の `useAudioLibrary` の `soundMap`、`window.myAPI.get_mcSoundHash`
- Produces:
  - `function useAudioBufferCache(): { preload: (soundIds: string[]) => Promise<void>; getBuffer: (soundId: string, variantIndex: number) => AudioBuffer | undefined; getAudioContext: () => AudioContext; clear: () => void }`
  - variantIndex = -1 は Random（すべての variant を保持、`getBuffer` 呼び出し時にランダム選択）

- [ ] **Step 1: 実装**

```ts
// src/web/Sub/hooks/useAudioBufferCache.ts
import { useCallback, useEffect, useRef } from 'react'
import { useAudioLibrary } from '../../../hooks/useAudioLibrary'

export function useAudioBufferCache() {
  const { soundMap } = useAudioLibrary()
  const ctxRef = useRef<AudioContext | null>(null)
  // key = `${soundId}#${variantIndex}` (variantIndex は 0-based のみキャッシュ)
  const cacheRef = useRef<Map<string, AudioBuffer>>(new Map())

  const getAudioContext = useCallback((): AudioContext => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }, [])

  const loadOne = useCallback(async (soundId: string, variantIndex: number): Promise<void> => {
    const variants = soundMap[soundId]
    if (!variants || !variants[variantIndex]) return
    const key = `${soundId}#${variantIndex}`
    if (cacheRef.current.has(key)) return
    const hash = variants[variantIndex].hash
    if (!hash) return
    const absPath = await window.myAPI.get_mcSoundHash(hash)
    if (!absPath) return
    const res = await fetch('file://' + absPath)
    const arr = await res.arrayBuffer()
    const buf = await getAudioContext().decodeAudioData(arr)
    cacheRef.current.set(key, buf)
  }, [soundMap, getAudioContext])

  const preload = useCallback(async (soundIds: string[]): Promise<void> => {
    const jobs: Promise<void>[] = []
    for (const id of soundIds) {
      const variants = soundMap[id] || []
      for (let i = 0; i < variants.length; i++) jobs.push(loadOne(id, i))
    }
    await Promise.all(jobs)
  }, [soundMap, loadOne])

  const getBuffer = useCallback((soundId: string, variantIndex: number): AudioBuffer | undefined => {
    const variants = soundMap[soundId] || []
    if (variants.length === 0) return undefined
    const idx = variantIndex === -1
      ? Math.floor(Math.random() * variants.length)
      : variantIndex
    return cacheRef.current.get(`${soundId}#${idx}`)
  }, [soundMap])

  const clear = useCallback(() => {
    cacheRef.current.clear()
  }, [])

  // アンマウント時に AudioContext を閉じる
  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {})
        ctxRef.current = null
      }
      cacheRef.current.clear()
    }
  }, [])

  return { preload, getBuffer, getAudioContext, clear }
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/hooks/useAudioBufferCache.ts
git commit -m "feat: useAudioBufferCache（AudioBuffer プリロード）を追加"
```

---

### Task 16: useTimelinePlayback フック（先読みスケジューラ）

**Files:**
- Create: `src/web/Sub/hooks/useTimelinePlayback.ts`

**Interfaces:**
- Consumes: `Marker`（Task 1）、`useAudioBufferCache`（Task 15）
- Produces:
  - `function useTimelinePlayback(params: { markers: Marker[]; lengthTicks: number; cache: ReturnType<typeof useAudioBufferCache> }): { isPlaying: boolean; currentTick: number; play: () => void; stop: () => void; seek: (tick: number) => void }`
  - `play()` は現在の `currentTick` から開始。`stop()` はスケジュール全解除して `currentTick = 0`。`seek()` は再生中でも即座に反映（再スケジュール）。
  - `currentTick` は `requestAnimationFrame` で更新される React state（60fps）。

- [ ] **Step 1: 実装**

```ts
// src/web/Sub/hooks/useTimelinePlayback.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Marker } from '../types/timeline'
import type { useAudioBufferCache } from './useAudioBufferCache'

const TICK_SEC = 0.05  // 1 tick = 50ms

interface Params {
  markers: Marker[]
  lengthTicks: number
  cache: ReturnType<typeof useAudioBufferCache>
}

export function useTimelinePlayback({ markers, lengthTicks, cache }: Params) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTick, setCurrentTick] = useState(0)

  // 再生中に参照するミュータブル状態
  const playStartAudioTimeRef = useRef<number>(0)  // AudioContext 上の再生開始時刻
  const startTickRef = useRef<number>(0)            // 再生開始時の tick
  const scheduledIdsRef = useRef<Set<string>>(new Set())  // すでにスケジュール済みマーカー id
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const rafRef = useRef<number | null>(null)

  const scheduleMarker = useCallback((m: Marker) => {
    const buf = cache.getBuffer(m.soundId, m.variantIndex)
    if (!buf) return
    const ctx = cache.getAudioContext()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = m.pitch
    const gain = ctx.createGain()
    gain.gain.value = m.volume
    src.connect(gain).connect(ctx.destination)
    const when = playStartAudioTimeRef.current + (m.tick - startTickRef.current) * TICK_SEC
    const safeWhen = Math.max(when, ctx.currentTime)
    src.start(safeWhen)
    activeSourcesRef.current.push(src)
    src.onended = () => {
      const idx = activeSourcesRef.current.indexOf(src)
      if (idx >= 0) activeSourcesRef.current.splice(idx, 1)
    }
  }, [cache])

  const stopAllSources = useCallback(() => {
    for (const s of activeSourcesRef.current) {
      try { s.stop() }
      catch { /* すでに停止済み */ }
      try { s.disconnect() }
      catch { /* noop */ }
    }
    activeSourcesRef.current = []
    scheduledIdsRef.current.clear()
  }, [])

  const tick = useCallback(() => {
    const ctx = cache.getAudioContext()
    const elapsedSec = ctx.currentTime - playStartAudioTimeRef.current
    const cur = startTickRef.current + elapsedSec / TICK_SEC
    setCurrentTick(cur)

    // 先読み: 現在時刻 + 100ms 内のマーカーを未スケジュール分だけ登録
    const lookaheadTick = cur + 0.1 / TICK_SEC
    for (const m of markers) {
      if (scheduledIdsRef.current.has(m.id)) continue
      if (m.tick < startTickRef.current) continue
      if (m.tick > lookaheadTick) continue
      scheduleMarker(m)
      scheduledIdsRef.current.add(m.id)
    }

    // 末尾到達で自動停止
    if (cur >= lengthTicks) {
      stopInternal()
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [markers, lengthTicks, scheduleMarker, cache])

  const stopInternal = useCallback(() => {
    stopAllSources()
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsPlaying(false)
  }, [stopAllSources])

  const play = useCallback(() => {
    if (isPlaying) return
    const ctx = cache.getAudioContext()
    // ユーザー操作起点の resume（AudioContext は最初は suspended）
    ctx.resume().catch(() => {})
    playStartAudioTimeRef.current = ctx.currentTime
    startTickRef.current = currentTick
    scheduledIdsRef.current.clear()
    setIsPlaying(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [isPlaying, cache, currentTick, tick])

  const stop = useCallback(() => {
    stopInternal()
    setCurrentTick(0)
  }, [stopInternal])

  const seek = useCallback((newTick: number) => {
    const wasPlaying = isPlaying
    stopInternal()
    setCurrentTick(Math.max(0, Math.min(lengthTicks, newTick)))
    if (wasPlaying) {
      // stopInternal 後に再度 play する必要があるが、currentTick が state 更新なので
      // 次レンダーで新しい tick から再開させるフラグを立てる方式ではなく、直接再開:
      const ctx = cache.getAudioContext()
      playStartAudioTimeRef.current = ctx.currentTime
      startTickRef.current = Math.max(0, Math.min(lengthTicks, newTick))
      scheduledIdsRef.current.clear()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [isPlaying, stopInternal, lengthTicks, cache, tick])

  // アンマウント時掃除
  useEffect(() => {
    return () => stopInternal()
  }, [stopInternal])

  return { isPlaying, currentTick, play, stop, seek }
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/hooks/useTimelinePlayback.ts
git commit -m "feat: useTimelinePlayback（先読みスケジューラ再生）を追加"
```

---

### Task 17: TimelinePlayhead コンポーネント

**Files:**
- Create: `src/web/Sub/components/TimelinePlayhead.tsx`

**Interfaces:**
- Consumes: `tickToPx`（Task 3）
- Produces: React コンポーネント `<TimelinePlayhead>` — props:
  ```ts
  { currentTick: number; pxPerTick: number; heightPx: number }
  ```
  絶対配置の縦線。`position: absolute`, `left = tickToPx(currentTick, pxPerTick)`, 上から下まで貫通。

- [ ] **Step 1: 実装**

```tsx
// src/web/Sub/components/TimelinePlayhead.tsx
import React from 'react'
import { Box } from '@yamada-ui/react'
import { tickToPx } from '../utils/tickPixel'

interface Props {
  currentTick: number
  pxPerTick: number
  heightPx: number
}

export const TimelinePlayhead: React.FC<Props> = ({ currentTick, pxPerTick, heightPx }) => {
  const left = tickToPx(currentTick, pxPerTick)
  return (
    <Box
      position="absolute"
      left={`${left}px`}
      top="0"
      w="2px"
      h={`${heightPx}px`}
      bg="red.500"
      pointerEvents="none"
      zIndex={10}
    />
  )
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/components/TimelinePlayhead.tsx
git commit -m "feat: TimelinePlayhead（プレイヘッド縦線）を追加"
```

---

### Task 18: TimelineEditor 統合（永続化 + 再生 + Playhead + キーボード）

**Files:**
- Modify: `src/web/Sub/components/TimelineEditor.tsx`

**Interfaces:**
- Consumes: `useTimeline`（Task 2）、`useAudioBufferCache`（Task 15）、`useTimelinePlayback`（Task 16）、`serialize` / `parse`（Task 13）、`TimelinePlayhead`（Task 17）、`TimelineToolbar`（Task 14 で拡張済）
- Produces: 拡張された `<TimelineEditor>` — 保存/読込・再生・シーク・ダーティフラグを内包

- [ ] **Step 1: 全面置換**

```tsx
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
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/web/Sub/components/TimelineEditor.tsx
git commit -m "feat: TimelineEditor に保存/読込/再生/プレイヘッドを統合"
```

---

### Task 19: 旧 UI 削除 + Sub App からトグル除去

**Files:**
- Modify: `src/web/Sub/App.tsx`
- Delete: `src/web/Sub/components/AudioGroup.tsx`
- Delete: `src/web/Sub/components/AudioControlWindow.tsx`

**Interfaces:**
- Produces: サブ App は `<TimelineEditor>` のみを表示

- [ ] **Step 1: 旧コンポーネント削除**

```bash
git rm src/web/Sub/components/AudioGroup.tsx
git rm src/web/Sub/components/AudioControlWindow.tsx
```

- [ ] **Step 2: App.tsx をタイムライン専用に戻す**

```tsx
// src/web/Sub/App.tsx
import React, { useEffect, useState } from 'react'
import { useAddDispatch, useAppSelector } from '../../store/_store'
import { updateSoundList, updateTargetVersion } from '../../store/fetchSlice'
import { TimelineEditor } from './components/TimelineEditor'
import { VersionInfoType } from '../../types/VersionInfo'

export const SubApp = () => {
  const dispatch = useAddDispatch()
  const targetVersion = useAppSelector(s => s.fetch.targetVersion)

  useEffect(() => {
    ;(async () => {
      const version = await window.myAPI.getSetting('selectedVersion')
      if (version) dispatch(updateTargetVersion({ targetVersion: version as VersionInfoType }))
    })()
  }, [dispatch])

  useEffect(() => {
    if (!targetVersion) return
    ;(async () => {
      const list = await window.myAPI.get_mcSounds(targetVersion.raw)
      dispatch(updateSoundList({ sounds: list }))
    })()
  }, [dispatch, targetVersion])

  useEffect(() => {
    ;(async () => {
      const list = await window.myAPI.getCurrentSounds()
      if (Array.isArray(list)) dispatch(updateSoundList({ sounds: list }))
    })()
  }, [dispatch])

  const [mainSelectedId, setMainSelectedId] = useState<string>('')
  useEffect(() => {
    const fetchMainSelectedId = async () => {
      const id = await window.myAPI.getMainSelectedSound()
      setMainSelectedId(id)
    }
    fetchMainSelectedId()
    const interval = setInterval(fetchMainSelectedId, 1000)
    return () => clearInterval(interval)
  }, [])

  return <TimelineEditor defaultSoundId={mainSelectedId} />
}
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit -p .`
Expected: エラーなし。旧コンポーネント参照は完全に消えているはず

- [ ] **Step 4: コミット**

```bash
git add src/web/Sub/App.tsx
git commit -m "refactor: 旧サウンドグループ UI を削除しタイムラインに統一"
```

---

### Task 20: Phase 2 手動検証

**Files:**
- （検証のみ、コミットなし）

- [ ] **Step 1: ビルド起動**

Run: `npm run dev`
Expected: エラーなく Electron 起動、サブウィンドウでタイムラインが表示

- [ ] **Step 2: 保存/読込サイクル**

- マーカーを 3 個ほど追加
- 「保存」ボタン → ダイアログ表示、`test.kp` として保存
- 「開く」→ 同じファイルを開く → マーカーが完全復元
- 保存直後: タイトル横の `*` が消えていること
- マーカー移動後: `*` が出現

- [ ] **Step 3: 再生**

- `Space` キー → 再生開始（またはツールバー ▶ ボタン）、プレイヘッドが左から右に進む
- マーカー通過時、音源が鳴る（soundId が設定されていれば）
- 末尾で自動停止
- 再生中に `Space` → 停止

- [ ] **Step 4: シーク**

- 停止中に Ruler をクリック → プレイヘッドが移動、そこから再生開始できる
- 再生中に Ruler クリック → 途切れずシークしてそのまま続行
- `Home` キー → プレイヘッドが t=0 に戻る

- [ ] **Step 5: 未保存確認ダイアログ**

- マーカーを変更（`*` 表示）
- 「開く」ボタン → 破棄確認ダイアログが出る、キャンセルで戻る、OK で新規読込
- （マーカー追加による新規状態も同じ扱い）

- [ ] **Step 6: 破損 .kp の読込**

- 適当なテキストファイル（拡張子だけ `.kp`）を作って開く
- エラーダイアログが出て状態は変わらない

- [ ] **Step 7: 何か不具合があれば個別コミットで修正**

Phase 2 の目視動作が問題なければ完了。
