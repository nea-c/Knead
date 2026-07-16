# TimelineEditor Phase 2 — マーカープロパティ編集パネル

- 作成日: 2026-07-16
- ステータス: Design (未実装)
- 対象ブランチ: `dev`

## 背景

Phase 1 で TimelineEditor は以下まで完成した。

- 単一トラック上でのマーカー配置・ドラッグ移動・削除
- タイムライン kp ファイルの開く / 保存
- 再生・一時停止・リセット・プレイヘッド・スクロール追従
- キーボードショートカット、未保存インジケータ

一方で `Marker` データモデルには `soundId` / `variantIndex` / `volume` / `pitch` などの編集手段が UI に存在せず、新規マーカーは常に `soundId=""` / `volume=1.0` / `pitch=1.0` で追加されるだけとなっている。

Phase 2 ではこのギャップを埋め、選択中マーカーの基本 5 プロパティを編集できるようにする。

## スコープ

### 含む

- 選択中マーカー **1 件** の以下 5 プロパティを編集可能にする:
  - `tick`
  - `soundId`
  - `variantIndex`
  - `volume`
  - `pitch`
- 下部固定ドロワー形式の編集パネル (`TimelinePropertyPanel`)。
- 選択なし / 複数選択時のプレースホルダー表示。

### 含まない (Phase 3 以降)

- 複数選択マーカーの一括編集
- `duration` / `retriggerInterval` の編集
- `volumeCurve` / `pitchCurve` の編集（トグル含む）
- Undo / Redo
- パネル折りたたみ・ドラッグリサイズ

## アーキテクチャ

新規コンポーネント **1 つ** と `TimelineEditor` への統合のみ。IPC・データモデル・serializer に変更なし。

```
TimelineEditor
├── TimelineToolbar          (既存)
├── スクロール可能領域        (既存)
│   ├── TimelineRuler
│   ├── TimelineTrack
│   └── TimelinePlayhead
└── TimelinePropertyPanel    ★ 新規 (下部固定, 高さ ~180px)
```

### コンポーネント: `TimelinePropertyPanel`

**責務:** props で渡された選択中マーカー 1 件の 5 プロパティを表示し、ユーザー操作を `onChange(patch: Partial<Marker>)` で親に伝える純粋な表示コンポーネント。**自身は state を持たない**（source of truth は `useTimeline`）。

**Props:**

```ts
interface Props {
  marker: Marker | null              // 単一選択時のみ非 null
  selectionCount: number             // 0 / 1 / 2 以上
  lengthTicks: number                // tick 上限バリデーション用
  soundIdList: string[]              // useAudioLibrary から
  variantCount: number               // 選択中 marker.soundId の variant 数
  onChange: (patch: Partial<Marker>) => void
}
```

**表示状態 3 パターン:**

| `selectionCount` | 表示 |
|---|---|
| 0 | 「マーカーを選択してください」プレースホルダー |
| 1 かつ `marker != null` | 5 フィールドのフォーム |
| 2 以上 | 「複数選択中（一括編集は Phase 3 以降）」プレースホルダー |

**フォーム内容（横並び, Flex, gap=4）:**

| フィールド | UI | 範囲・制約 | Marker 反映 |
|---|---|---|---|
| Tick | NumberInput（整数） | `0` ≤ v ≤ `lengthTicks - 1` | `{ tick: v }` |
| Sound | Select（`soundIdList` + 空値） | 空文字も許可（未指定を保持） | `{ soundId: v }` |
| Variant | Select | `-1: ランダム` + `0..variantCount-1`。`variantCount === 0` の場合は disabled | `{ variantIndex: v }` |
| Volume | Slider (0–1, step 0.01) + 数値表示 | 0 ≤ v ≤ 1 | `{ volume: v }` |
| Pitch | Slider (0.5–2.0, step 0.01) + 数値表示 | 0.5 ≤ p ≤ 2.0 | `{ pitch: v }` |

`useTimeline.updateMarker` は既存で `tick` のクランプを行う。上限バリデーションは Panel 側の UI 制約（NumberInput の max）と、既存クランプ両方で担保する。

### データフロー

```
User 操作
  → TimelinePropertyPanel.onChange({ volume: 0.7 })
  → TimelineEditor: timeline.updateMarker(marker.id, { volume: 0.7 })
  → useTimeline: setState(produce(...))
  → 再レンダリング → 新しい marker を Panel の props で受け直す
```

### 既存動作への波及

- **Dirty 化:** 既存 `useEffect([timeline.state], setDirty(true))` が自動で追随。追加処理不要。
- **AudioBuffer プリロード:** `soundId` 変更時は既存の preload-key useEffect が新 ID セットを検出し `cache.preload(ids)` を呼ぶ。追加処理不要。
- **キーボードショートカット:** Panel 内 `INPUT` / `BUTTON` にフォーカスがある間は既存の `if (target.tagName === 'INPUT' ...) return` により発火しない。想定通り。
- **プレイヘッド追従スクロール:** スクロール領域の高さが Panel 分縮むが、`flex="1"` によって領域は保たれる。挙動変わらず。

## `TimelineEditor` 統合

`TimelineEditor.tsx` の JSX 末尾に以下を追加する（既存要素は据え置き）:

```tsx
const singleSelectedId =
  selectedIds.size === 1 ? Array.from(selectedIds)[0] : null
const singleSelected =
  singleSelectedId ? timeline.state.markers.find(m => m.id === singleSelectedId) ?? null : null
const variantCount = singleSelected
  ? (soundMap[singleSelected.soundId]?.length ?? 0)
  : 0

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

`useAudioLibrary()` を `TimelineEditor` の冒頭で呼び、`soundIdList` / `soundMap` を取得する。

## テスト計画

**Vitest コンポーネントテスト（`TimelinePropertyPanel.test.tsx`）:**

1. `selectionCount === 0` → プレースホルダー「マーカーを選択してください」が表示される。
2. `selectionCount === 2` → プレースホルダー「複数選択中」が表示される。
3. `selectionCount === 1` + marker → 5 フィールドが表示され、初期値が marker の値と一致する。
4. Volume slider を 0.5 に動かす → `onChange({ volume: 0.5 })` が呼ばれる。
5. Sound select を変更 → `onChange({ soundId: '...' })` が呼ばれる。
6. Variant: `variantCount === 0` のとき Select が disabled。
7. Variant: `variantCount === 3` のとき `-1..2` の 4 択が表示される。
8. Tick NumberInput の max が `lengthTicks - 1` に設定される。

**手動確認:**

- マーカー選択 → Panel に情報表示 → Slider 動かして再生 → 音量/音高が反映されて再生される
- Sound 変更後にプリロード完了を待って再生し、正しい音が鳴る
- 未保存表示 `*` が Panel 経由の変更でも点灯する

## 実装順（想定）

1. `TimelinePropertyPanel.tsx` を新規作成（プレースホルダー 2 状態 + 空フォーム）
2. 5 フィールドを段階的に実装（tick → sound → variant → volume → pitch）
3. `TimelineEditor.tsx` に統合、`useAudioLibrary()` を呼び出し
4. コンポーネントテスト追加
5. 手動確認 → コミット

## 未決事項

なし。
