# TimelineEditor Phase 2 (プロパティ編集パネル) 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TimelineEditor に「選択中マーカー 1 件の基本 5 プロパティ (tick / soundId / variantIndex / volume / pitch) を編集できる下部固定パネル」を追加する。

**Architecture:** 状態を持たない純粋な表示コンポーネント `TimelinePropertyPanel` を新規作成し、`TimelineEditor` から `useTimeline.updateMarker` を介して既存 state を更新する。IPC・データモデル・シリアライザは触らない。

**Tech Stack:** React 18 / TypeScript / Yamada UI (`Slider`, `NumberInput`, `Select`) / immer (既存 `useTimeline` 経由)

## Global Constraints

- 依存追加禁止 (`@yamada-ui/react` の既存部品のみ利用)。
- テストは Vitest/Jest を用いず、`package.json` の `selfcheck` script に純関数の self-check を連ねる方式に従う。純関数が生じない場合は手動確認のみ。
- 既存パターンに合わせ、コメントは非自明な理由 (バグ回避理由・仕様参照) にのみ書く。
- ファイル冒頭に `// src/web/Sub/components/...` のようなパスコメントは、周辺ファイルが持っていれば揃える（`TimelineEditor.tsx` は持っている、他は持っていない → 新規ファイルはパスコメント不要）。
- 単一責務: `TimelinePropertyPanel.tsx` に UI ロジック以外を混入させない。

**設計仕様書:** `docs/superpowers/specs/2026-07-16-timeline-property-panel-design.md`

---

## File Structure

**新規作成:**
- `src/web/Sub/components/TimelinePropertyPanel.tsx` — 選択中マーカー 1 件の 5 プロパティ編集 UI (state を持たない)。

**変更:**
- `src/web/Sub/components/TimelineEditor.tsx` — Panel を末尾に配置し、`useAudioLibrary()` から `soundIdList` / `soundMap` を取り込む。

**変更なし（依存として使用のみ）:**
- `src/web/Sub/hooks/useTimeline.ts` — 既存 `updateMarker(id, patch)` を利用。
- `src/hooks/useAudioLibrary.ts` — 既存 `{ soundIdList, soundMap }` を利用。
- `src/web/Sub/types/timeline.ts` — 既存 `Marker` 型を利用。

---

## Task 1: `TimelinePropertyPanel` コンポーネントを新規作成

**Files:**
- Create: `src/web/Sub/components/TimelinePropertyPanel.tsx`

**Interfaces:**
- Consumes: `Marker` from `../types/timeline`
- Produces:
  ```ts
  interface TimelinePropertyPanelProps {
    marker: Marker | null
    selectionCount: number
    lengthTicks: number
    soundIdList: string[]
    variantCount: number
    onChange: (patch: Partial<Marker>) => void
  }
  export const TimelinePropertyPanel: React.FC<TimelinePropertyPanelProps>
  ```

- [ ] **Step 1: ファイル新規作成 (全体を一度に書く)**

Create: `src/web/Sub/components/TimelinePropertyPanel.tsx`

```tsx
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
      <Box h={`${PANEL_HEIGHT}px`} bg="gray.900" borderTop="1px solid" borderColor="gray.700"
        display="flex" alignItems="center" justifyContent="center">
        <Text color="gray.500">マーカーを選択してください</Text>
      </Box>
    )
  }
  if (selectionCount >= 2 || marker === null) {
    return (
      <Box h={`${PANEL_HEIGHT}px`} bg="gray.900" borderTop="1px solid" borderColor="gray.700"
        display="flex" alignItems="center" justifyContent="center">
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
    <Box h={`${PANEL_HEIGHT}px`} bg="gray.900" borderTop="1px solid" borderColor="gray.700"
      p="4" overflow="auto">
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
            onChange={(v) => onChange({ soundId: v })}
            w="240px"
            placeholderInOptions={false}
          />
        </Box>

        <Box minW="140px">
          <Text fontSize="sm" color="gray.400" mb="1">Variant</Text>
          <Select
            value={String(marker.variantIndex)}
            items={variantItems}
            onChange={(v) => onChange({ variantIndex: parseInt(v, 10) })}
            disabled={variantCount === 0}
            w="140px"
            placeholderInOptions={false}
          />
        </Box>

        <Box minW="200px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Volume: {marker.volume.toFixed(2)}
          </Text>
          <Slider
            value={marker.volume}
            min={0} max={1} step={0.01}
            onChange={(v) => onChange({ volume: v })}
            w="200px"
            focusThumbOnChange={false}
          />
        </Box>

        <Box minW="200px">
          <Text fontSize="sm" color="gray.400" mb="1">
            Pitch: {marker.pitch.toFixed(2)}
          </Text>
          <Slider
            value={marker.pitch}
            min={0.5} max={2.0} step={0.01}
            onChange={(v) => onChange({ pitch: v })}
            w="200px"
            focusThumbOnChange={false}
          />
        </Box>
      </Flex>
    </Box>
  )
}
```

- [ ] **Step 2: 型チェックを走らせて構文エラーがないか確認**

Run: `cd d:/Minecraft/Git/Knead && npx tsc --noEmit -p tsconfig.json`
Expected: 新規ファイル起因のエラーが 0 件 (プロジェクト側の既存エラーが出ていたとしても、`TimelinePropertyPanel.tsx` を含む行が出ないこと)。

- [ ] **Step 3: Lint を走らせて既存規約に合っているか確認**

Run: `cd d:/Minecraft/Git/Knead && npm run lint -- src/web/Sub/components/TimelinePropertyPanel.tsx`
Expected: エラーなし（`--fix` により整形される可能性あり、その場合は Step 4 でまとめてコミット）。

- [ ] **Step 4: コミット**

```bash
cd d:/Minecraft/Git/Knead
git add src/web/Sub/components/TimelinePropertyPanel.tsx
git commit -m "feat: TimelinePropertyPanel（マーカー基本 5 プロパティ編集）を追加"
```

---

## Task 2: `TimelineEditor` に統合

**Files:**
- Modify: `src/web/Sub/components/TimelineEditor.tsx`

**Interfaces:**
- Consumes: Task 1 で公開した `TimelinePropertyPanel` と、既存 `useAudioLibrary` / `useTimeline.updateMarker`.
- Produces: なし (エンドユーザー可視の UI 変更で完結)

- [ ] **Step 1: `useAudioLibrary` の import を追加**

Modify: `src/web/Sub/components/TimelineEditor.tsx`

`TimelineEditor.tsx` の import ブロック末尾に以下を追加:

```tsx
import { useAudioLibrary } from '../../../hooks/useAudioLibrary'
import { TimelinePropertyPanel } from './TimelinePropertyPanel'
```

パスの深さ: `src/web/Sub/components/` から `src/hooks/` は `../../../hooks/`。実際に相対パスが通るか型チェックで確認する。

- [ ] **Step 2: コンポーネント関数の冒頭で `useAudioLibrary` を呼ぶ**

`TimelineEditor` の `const timeline = useTimeline()` の直下に追加:

```tsx
const { soundIdList, soundMap } = useAudioLibrary()
```

- [ ] **Step 3: 単一選択マーカーと variantCount を算出**

`sortedMarkers` の `useMemo` の直後に追加:

```tsx
const singleSelectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null
const singleSelected = singleSelectedId
  ? timeline.state.markers.find(m => m.id === singleSelectedId) ?? null
  : null
const variantCount = singleSelected ? (soundMap[singleSelected.soundId]?.length ?? 0) : 0
```

- [ ] **Step 4: JSX の外側 `<Box>` 内、スクロール領域の直後に Panel を差し込む**

`</Box>` (スクロール `Box ref={scrollRef}` の閉じ) の直後、外側 `</Box>` の直前に追加:

```tsx
<TimelinePropertyPanel
  marker={singleSelected}
  selectionCount={selectedIds.size}
  lengthTicks={timeline.state.lengthTicks}
  soundIdList={soundIdList}
  variantCount={variantCount}
  onChange={(patch) => {
    if (singleSelectedId) timeline.updateMarker(singleSelectedId, patch)
  }}
/>
```

差し込み後の JSX 骨格 (該当部のみ):

```tsx
return (
  <Box display="flex" flexDir="column" h="100vh" bg="gray.950">
    <TimelineToolbar ... />
    <Box ref={scrollRef} flex="1" overflow="auto">
      <Box position="relative" w={`${contentWidth}px`}>
        <TimelineRuler ... />
        <TimelineTrack ... />
        <TimelinePlayhead ... />
      </Box>
    </Box>
    <TimelinePropertyPanel
      marker={singleSelected}
      selectionCount={selectedIds.size}
      lengthTicks={timeline.state.lengthTicks}
      soundIdList={soundIdList}
      variantCount={variantCount}
      onChange={(patch) => {
        if (singleSelectedId) timeline.updateMarker(singleSelectedId, patch)
      }}
    />
  </Box>
)
```

- [ ] **Step 5: 型チェック**

Run: `cd d:/Minecraft/Git/Knead && npx tsc --noEmit -p tsconfig.json`
Expected: 統合起因のエラーなし。

- [ ] **Step 6: Lint**

Run: `cd d:/Minecraft/Git/Knead && npm run lint -- src/web/Sub/components/TimelineEditor.tsx`
Expected: エラーなし。

- [ ] **Step 7: コミット**

```bash
cd d:/Minecraft/Git/Knead
git add src/web/Sub/components/TimelineEditor.tsx
git commit -m "feat: TimelineEditor に TimelinePropertyPanel を統合"
```

---

## Task 3: 手動確認と self-check の連結

**Files:**
- Modify: `package.json` (self-check の連結が必要な場合のみ)

**Interfaces:**
- Consumes: Task 1, Task 2 の統合結果
- Produces: なし (検証タスク)

- [ ] **Step 1: 開発ビルドを起動**

Run: `cd d:/Minecraft/Git/Knead && npm run dev`
Expected: webpack ビルド成功 → Electron が起動 → メインウィンドウ表示。

（起動中プロセスは背景で回し続ける。次のステップと並行して観察する。）

- [ ] **Step 2: サブウィンドウ (タイムラインエディタ) を開く**

Expected: サブウィンドウが開いたら「新タイムライン」トグルを ON にして TimelineEditor を表示。下部に「マーカーを選択してください」のプレースホルダーが見える。

- [ ] **Step 3: 手動確認チェックリスト**

以下を上から順に実施し、それぞれ Expected を満たしたら次へ進む。1 つでも満たさない場合は原因を特定して修正 → Step 1 からやり直す。

1. **未選択プレースホルダー**: マーカーが 0 件 or 未選択 → 「マーカーを選択してください」表示。
2. **単一選択でフォーム表示**: `+ マーカー追加` → 生成マーカーをクリック選択 → Tick / Sound / Variant / Volume / Pitch の 5 フィールドが表示され、初期値が `tick=0, soundId='', variantIndex=-1, volume=1.00, pitch=1.00` であること。
3. **複数選択プレースホルダー**: DevTools コンソールで `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }))` を実行して全選択 → マーカーが 2 件以上あれば「複数選択中」表示に切り替わる (2 件未満なら 2 件追加してからやり直す)。
4. **Volume 反映**: 単一選択に戻し、Volume slider を 0.5 に → ラベルが `Volume: 0.50` に変わる。▶再生 → 音量が半分で鳴る (Sound 未指定なら Sound を先に選ぶ)。
5. **Pitch 反映**: Pitch slider を 1.50 に → ラベルが `Pitch: 1.50` に変わる。▶再生 → 音高が上がる。
6. **Sound 変更 + プリロード**: Sound select で任意の ID に変更 → ツールバーが「読込中…」表示になり、完了後に ▶再生 で選んだ音が鳴る。
7. **Variant 選択**: 選んだ Sound が複数 variant を持つ場合、Variant を `-1: ランダム` から `0` へ変更 → ▶再生を数回繰り返しても常に同じ variant が鳴る。
8. **Variant disabled**: Sound を `(未指定)` に戻す → Variant Select が disabled になる。
9. **Tick クランプ**: Tick NumberInput に `lengthTicks` (現状 200) 以上を入力しようとしても `199` にクランプされる。
10. **Dirty 表示**: 上記いずれの変更後もツールバー右上のファイル名の先頭に `*` が付く。ウィンドウタイトルにも `* Knead - (未保存)` などが表示される。
11. **保存 → 開く往復**: 「名前を付けて保存」→ 保存後 `*` が消える → 「開く」で同ファイルを読込 → Panel の値が保存前と一致する。

- [ ] **Step 4: dev サーバーを停止**

Run: 起動プロセスを Ctrl+C で停止 (背景で回している場合は該当プロセスを kill)。

- [ ] **Step 5: 純関数ヘルパーが生じていない事を確認**

Panel 実装が Task 1 の Step 1 コードのみで完結しているか grep で確認する:

Run: `cd d:/Minecraft/Git/Knead && grep -n "_selfCheck\|export function " src/web/Sub/components/TimelinePropertyPanel.tsx`
Expected: マッチなし（Panel コンポーネントの `export const TimelinePropertyPanel` のみ）。もし切り出された純関数があれば、`_selfCheckPropertyPanel()` を末尾に追加し、`package.json` の `selfcheck` script に `; require('./src/web/Sub/components/TimelinePropertyPanel')._selfCheckPropertyPanel()` を連結してこの Step を再実行する。

- [ ] **Step 6: 手動確認完了を示す空コミット (履歴に節目を残す)**

チェックリストを完走できていて追加変更が無い場合のみ実施:

```bash
cd d:/Minecraft/Git/Knead
git commit --allow-empty -m "chore: TimelinePropertyPanel Phase 2 手動確認完了"
```

Step 5 で package.json を編集した場合は空コミットではなく通常コミット:

```bash
cd d:/Minecraft/Git/Knead
git add src/web/Sub/components/TimelinePropertyPanel.tsx package.json
git commit -m "chore: TimelinePropertyPanel の self-check を selfcheck script に連結"
```

---

## Self-Review

**1. Spec coverage:**

| Spec セクション | 対応タスク |
|---|---|
| `TimelinePropertyPanel` Props | Task 1 Step 1 |
| 表示状態 3 パターン | Task 1 Step 1 (`selectionCount === 0` / `>= 2` / `1`) |
| 5 フィールド (Tick/Sound/Variant/Volume/Pitch) | Task 1 Step 1 |
| データフロー (onChange → updateMarker) | Task 2 Step 4 |
| Dirty / プリロードは自動追随 | 確認: Task 3 Step 3 の項目 10 / 6 |
| TimelineEditor 統合 (パネル配置 + `useAudioLibrary`) | Task 2 Step 2, 3, 4 |
| 手動確認チェックリスト全 10 項目 | Task 3 Step 3 (11 項目に拡張済) |
| self-check 連結ルール | Task 3 Step 5 |

漏れなし。

**2. Placeholder scan:** "TBD" / "TODO" / "後で" / "適宜" 等の未確定表現なし。全ステップに具体的なコード or コマンドを記載済。

**3. Type consistency:** Task 1 の `interface Props` に定義した `marker: Marker | null` / `selectionCount: number` / `variantCount: number` / `onChange: (patch: Partial<Marker>) => void` は Task 2 Step 4 の Panel 呼び出し側でも同じ型・同じプロパティ名で渡されている。`singleSelectedId` (string | null) と `singleSelected` (Marker | null) の関係も一貫。variant Select の value 型は「文字列で保持し数値へ変換」に統一 (Task 1 内で `String(marker.variantIndex)` と `parseInt(v, 10)` が対応)。
