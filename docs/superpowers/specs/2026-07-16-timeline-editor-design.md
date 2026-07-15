# サブウィンドウ タイムラインエディタ 設計書

- 日付: 2026-07-16
- 対象: `src/web/Sub/` 配下（Electron サブウィンドウ）
- ステータス: 設計承認済み、実装計画待ち

## 概要

現在のサブウィンドウは「複数の音声グループ（音源 + バリアント + ピッチ + 音量 + 遅延）を並列再生するリスト」として実装されている。これを **時間軸上にマーカーを配置して再生タイミングを編集できるタイムラインエディタ** に段階的に置き換える。

Minecraft の tick（1/20 秒 = 50ms）を基本単位とし、各マーカーは単発トリガーとして機能する。必要に応じてマーカーに「持続時間 + 一定間隔リトリガー」モードを付与でき、その際に音量とピッチを Blender ライクなキーフレーム（Linear / Bezier）で自動化できる。

## 決定事項サマリ

| 項目 | 決定 |
|---|---|
| タイムラインメタファー | マーカー / キーフレーム型（点イベント、クリップ長は基本表示しない） |
| レーン構造 | シングルレーン（1本の時間軸） |
| 時間単位 | 1/20 秒（tick）固定、整数 |
| 編集操作 | 複数選択、一括ドラッグ、コピー&ペースト、Undo/Redo |
| 再生モデル | プレイヘッド走査（左→右へ現在時刻カーソルが移動） |
| マーカー種別 | 単発（1発トリガー） + 連続（duration の間、指定間隔でリトリガー） |
| カーブ表現 | Blender 風キーフレーム列、Linear / Bezier のみ |
| 永続化 | 明示保存/読込、拡張子 `.kp`（Knead Project）、中身は JSON |
| 実装戦略 | 段階リプレース（4 フェーズ） |

## 1. データモデル

```ts
// 1 tick = 1/20 秒 = 50ms
type Tick = number  // 整数

interface Keyframe {
  tick: Tick             // マーカー起点からの相対 tick（0 = マーカー先頭）
  value: number          // volume: 0..1, pitch: 0.5..2.0
  interpolation: 'linear' | 'bezier'
  // Bezier のときのみ意味を持つ（Linear のとき無視）
  handleL?: { dt: number, dv: number }  // 左ハンドル（前セグメント終端側）
  handleR?: { dt: number, dv: number }  // 右ハンドル（次セグメント始点側）
}

interface Curve {
  keyframes: Keyframe[]  // tick 昇順、最低 1 点（0 点は不可、その場合は Curve フィールド自体を undefined にする）
}

interface Marker {
  id: string             // UUID
  tick: Tick             // タイムライン絶対時刻
  soundId: string
  variantIndex: number   // -1 = Random
  volume: number         // 単発時 or カーブ無し時の値（0..1）
  pitch: number          // 単発時 or カーブ無し時の値（0.5..2.0）
  duration?: Tick        // 未定義または 0 = 単発モード
  retriggerInterval?: Tick  // 連続モード時、この間隔で再発火（undefined 時は既定 5 tick で解釈）
  volumeCurve?: Curve    // 連続モード時のみ有効
  pitchCurve?: Curve
}

interface Timeline {
  format: 'knead-project'  // ファイル識別用マジック
  version: 1               // フォーマットバージョン
  targetVersion: string    // 保存時の Minecraft バージョン（例: "1.21.4"）
  lengthTicks: Tick        // タイムライン全体の長さ
  markers: Marker[]        // id で一意
}
```

**設計方針:**
- 単発 / 連続はフラグではなく `duration` の有無で判別（同じ Marker 型）
- カーブは「マーカー起点からの相対 tick」で保持 → マーカー移動時にカーブ再計算不要
- Bezier ハンドルの `dt/dv` はキーフレームからの相対オフセット
- `variantIndex: -1` は既存仕様（Random）を踏襲
- `volumeCurve` / `pitchCurve` 自体が undefined = マーカーのスカラー `volume`/`pitch` を使用
- キーフレーム 1 個のみ = その値で一定

## 2. アーキテクチャ / コンポーネント構成

```
src/web/Sub/
  App.tsx                              # 変更: AudioControlWindow → TimelineEditor
  types/
    timeline.ts                        # 【新規】Marker, Curve, Keyframe, Timeline 型定義
  components/
    TimelineEditor.tsx                 # 【新規】ルートコンテナ、状態管理
    TimelineToolbar.tsx                # 【新規】上部ツールバー
    TimelineRuler.tsx                  # 【新規】tick 目盛り
    TimelineTrack.tsx                  # 【新規】マーカー配置エリア（1レーン）
    TimelineMarker.tsx                 # 【新規】1マーカーの描画
    TimelinePlayhead.tsx               # 【新規】プレイヘッド縦線
    PropertyPanel.tsx                  # 【新規】選択マーカーの属性編集
    CurveEditor.tsx                    # 【新規】volume/pitch のグラフエディタ
    AudioSelectDropdown.tsx            # 【流用】既存
    AudioGroup.tsx                     # 【削除】Phase 2 完了時
    AudioControlWindow.tsx             # 【削除】Phase 2 完了時
  hooks/
    useTimeline.ts                     # 【新規】Timeline 状態 + CRUD + Undo/Redo
    useTimelinePlayback.ts             # 【新規】プレイヘッド駆動 + マーカー発火
    useAudioPlayV2.ts                  # 【流用/参考】既存
```

### 画面レイアウト

```
┌─────────────────────────────────────────────────────────┐
│ TimelineToolbar: [開く][保存][名前を付けて保存] [▶再生][■停止] │
│                  [↺Undo][Redo↻] [+ マーカー追加]        │
├─────────────────────────────────────────────────────────┤
│ TimelineRuler:  0    20   40   60   80  100 (tick)      │
├─────────────────────────────────────────────────────────┤
│ TimelineTrack:                                          │
│         ●        ●   ●━━━━━(duration)━━━━━●          │
│                     ↑ プレイヘッド                      │
├─────────────────────────────────────────────────────────┤
│ PropertyPanel (下部, 折りたたみ可):                     │
│   選択中: soundId, variant, volume, pitch, duration ... │
│   [ CurveEditor: volumeCurve ] [ CurveEditor: pitchCurve ] │
└─────────────────────────────────────────────────────────┘
```

### 責務

- **TimelineEditor**: 全体状態を hold、子への props 配信、キーボードショートカット統括
- **useTimeline**: マーカーの CRUD、Undo/Redo スタック（immer で immutable 操作）
- **useTimelinePlayback**: 既存 `useAudioPlayV2` の仕組みを流用し、プレイヘッド進行に応じてマーカーを AudioContext でスケジュール発火
- **CurveEditor**: SVG ベースの折れ線 + ハンドル描画、ドラッグ操作
- **状態管理**: React state + immer（`useTimeline` に内包）。Redux は使わない（サブウィンドウ内完結、Undo/Redo と相性が良い）

## 3. 編集操作

### マーカー操作（TimelineTrack 上）

| 操作 | 挙動 |
|---|---|
| 追加 | ツールバー「+ マーカー追加」でプレイヘッド位置に追加、または空白ダブルクリック |
| 選択（単一） | クリック |
| 選択（範囲） | 空白を Shift+ドラッグ で矩形選択、内包マーカーを一括選択 |
| 選択（トグル） | `Ctrl/Cmd+クリック` で追加/解除 |
| 全選択 | `Ctrl/Cmd+A` |
| 移動 | 選択マーカーを左右ドラッグ。tick スナップ。複数選択時は一括平行移動 |
| 削除 | `Delete` / `Backspace` |
| コピー / ペースト | `Ctrl/Cmd+C` / `Ctrl/Cmd+V`。ペーストはプレイヘッド位置基準で相対配置 |
| Undo | `Ctrl/Cmd+Z` |
| Redo | `Ctrl/Cmd+Y` |

### CurveEditor 上の操作

| 操作 | 挙動 |
|---|---|
| キーフレーム追加 | グラフ空白部を Shift+クリック（Blender 準拠） |
| 選択 | クリック / Ctrl+クリックで複数 |
| 移動 | ドラッグ（t/v 両軸）。t 軸はマーカー内 0..duration にクランプ |
| 補間切替 | 選択キーフレームで `T` キー押下 → Linear ⇔ Bezier トグル |
| ハンドル編集 | Bezier のときのみハンドル表示。ハンドルドラッグで曲線調整 |
| 削除 | `Delete` / `Backspace` |
| プリセット適用 | 選択キーフレーム右クリック → Ease In / Out / InOut を Bezier ハンドル既定値として適用 |

### プレイヘッド操作

- Ruler クリックで任意 tick にシーク
- `Space` で再生/一時停止トグル
- `Home` で t=0 に戻す

### Undo/Redo スタック

- スタック単位: マーカー追加/削除/移動/属性変更/カーブ編集 の各アトミック操作
- ドラッグ中は "1回の変更" として扱い、ドラッグ終了時にスタックに積む
- スタック上限: 100 段（メモリ節約）

## 4. 再生エンジン

### プレイヘッド走査モデル

再生開始時に「t=start の時点でスケジュールすべきマーカー」を全て事前スケジュール、その後は Web Audio の内部クロックに任せる。ジッター対策として `AudioContext.currentTime` を絶対基準に使う（`setInterval` は精度不足）。

### タイミング計算

```
playStartAudioTime = audioContext.currentTime   // 再生ボタン押下時
tickToAudioTime(marker.tick) 
  = playStartAudioTime + (marker.tick - startTick) * 0.05
```

- 各マーカーの `source.start(scheduledAudioTime)` を発火時刻より先に予約
- 100ms 先読みでループしながら未スケジュール分を予約 → シークや停止に追従

### プレイヘッド表示更新

- `requestAnimationFrame` で `AudioContext.currentTime` から現在 tick を逆算し UI 再描画
- 精度: ~16ms（60fps）で十分

### 連続モード（duration > 0）のマーカー発火

```
発火回数 = floor(duration / retriggerInterval) + 1
各発火時刻 tick_i = marker.tick + i * retriggerInterval  (i = 0..N)
各発火時の volume_i = sampleCurve(volumeCurve, i * retriggerInterval)
各発火時の pitch_i  = sampleCurve(pitchCurve,  i * retriggerInterval)
```

各リトリガーは独立した `AudioBufferSourceNode` として発火。`volume` は `GainNode.gain.value` に、`pitch` は `source.playbackRate.value` にセット。

### カーブサンプリング

- Linear セグメント: 2点の線形補間
- Bezier セグメント: 3次ベジェを二分探索で t 逆算（DAW 標準手法）
- カーブ自体が undefined = マーカーの `volume`/`pitch` スカラー値を使用
- キーフレーム 1 個のみ = その値で一定
- サンプル tick が最初のキーフレームより前 = 最初のキーフレームの値でクランプ、最後のキーフレームより後 = 最後の値でクランプ（extrapolation なし）
- Bezier ハンドル既定値（Ease In/Out/InOut）は共通定数化

### 停止 / 一時停止 / シーク

| 操作 | 実装 |
|---|---|
| 停止 | スケジュール済み全 source を `stop()` してクリア、playhead を 0 に戻す |
| 一時停止 | `audioContext.suspend()` → プレイヘッド固定、再開時に `resume()` |
| シーク | 既存 source を全 stop、新しい startTick で再スケジュール |

### 音源プリロード

- 使用中の全 `soundId × variantIndex` のバッファをタイムライン読込時にプリロード
- `AudioContext.decodeAudioData` の結果を `Map<hash, AudioBuffer>` にキャッシュ
- 再生中の逐次ロードは行わない（発火タイミング安定のため）

## 5. 永続化（保存/読込）

### ファイル形式

- **拡張子**: `.kp`（Knead Project）
- **中身**: UTF-8 JSON
- **識別子**: JSON トップレベルに `format: "knead-project"` を必須フィールドとして持つ

```json
{
  "format": "knead-project",
  "version": 1,
  "targetVersion": "1.21.4",
  "lengthTicks": 200,
  "markers": [
    {
      "id": "3f8b...",
      "tick": 20,
      "soundId": "block.note_block.pling",
      "variantIndex": -1,
      "volume": 1.0,
      "pitch": 1.0
    },
    {
      "id": "a12c...",
      "tick": 60,
      "soundId": "ambient.cave",
      "variantIndex": 0,
      "volume": 0.8,
      "pitch": 1.0,
      "duration": 40,
      "retriggerInterval": 4,
      "volumeCurve": {
        "keyframes": [
          { "tick": 0,  "value": 0.0, "interpolation": "linear" },
          { "tick": 20, "value": 1.0, "interpolation": "bezier",
            "handleL": { "dt": -6, "dv": 0 },
            "handleR": { "dt":  6, "dv": 0 } },
          { "tick": 40, "value": 0.0, "interpolation": "linear" }
        ]
      }
    }
  ]
}
```

### 設計方針

- `version: 1` で将来の後方互換を確保。読込時 `version > 1` は警告後拒否
- `targetVersion` は保存時の Minecraft バージョン。読込時に現行と異なれば警告表示（`soundId` 不在の可能性）
- 音源データそのものは埋め込まず、`soundId` 参照のみ

### IPC / メイン側実装

Electron のメインプロセスに新 IPC を追加：

```ts
window.myAPI.timeline.saveDialog(json: string): Promise<string | null>
window.myAPI.timeline.openDialog(): Promise<{ path: string, json: string } | null>
```

- メイン側で `dialog.showSaveDialog` / `showOpenDialog` を使用
- フィルタ: `filters: [{ name: 'Knead Project', extensions: ['kp'] }]`
- ファイル IO はメインプロセスで実行、レンダラは JSON 文字列のみ扱う

### UI

- ツールバー: `[開く] [保存] [名前を付けて保存]` の 3 ボタン
- 未保存変更ありの場合はウィンドウタイトルに `*` を表示
- 未保存で新規/開く時は「変更を破棄しますか？」の確認ダイアログ
- MRU（最近使ったファイル）は不要（今回スコープ外）

### 読込時のバリデーション

- JSON パース失敗 → エラーダイアログ、状態変更なし
- `format !== "knead-project"` → エラー
- `version > 1` → エラー
- スキーマ違反（必須フィールド欠落、型不一致）→ エラーダイアログ、詳細ログ
- `soundId` が現行 Minecraft バージョンに存在しない → マーカーは残すが「無効」フラグを付けて赤表示、再生時はスキップ

## 6. 段階リプレース（Phase 分割）

各 Phase 完了時点で **動く成果物** が出せる粒度。

### Phase 1: データモデル + 静的タイムライン表示

**成果物**: マーカーを追加/表示できる。再生機能はまだ「単発 play ボタン」だけ。

- `src/web/Sub/types/timeline.ts` に型定義
- `useTimeline` フック（状態 + CRUD、Undo/Redo なし）
- `TimelineEditor`, `TimelineToolbar`, `TimelineRuler`, `TimelineTrack`, `TimelineMarker` の骨組み
- クリック追加、ドラッグ移動（単一選択のみ）、Delete で削除
- 既存 `AudioGroup` / `AudioControlWindow` はまだ残す（Sub `App.tsx` でトグル切替）
- 単発マーカーのみ、`duration` フィールドは未使用

### Phase 2: 再生エンジン + 永続化

**成果物**: プレイヘッド走査、`.kp` 保存/読込。実質的にタイムラインエディタとして使える MVP。

- `useTimelinePlayback` 実装（先読みスケジューラ、AudioContext ベース）
- `TimelinePlayhead` コンポーネント、Space で再生/停止、Ruler クリックでシーク
- IPC 追加: `timeline.saveDialog`, `timeline.openDialog`
- ツールバーに `[開く] [保存] [名前を付けて保存] [▶再生] [■停止]`
- 音源プリロード（`Map<hash, AudioBuffer>`）
- 未保存変更フラグ + タイトル `*` 表示 + 破棄確認ダイアログ
- **旧 UI 削除**: `AudioGroup.tsx`, `AudioControlWindow.tsx`

### Phase 3: 編集強化（複数選択 + Undo/Redo + コピペ）

**成果物**: 実用的なエディタ体験。

- 矩形選択（Shift+ドラッグ）、Ctrl+クリック追加選択、Ctrl+A 全選択
- 複数選択の一括ドラッグ移動
- Undo/Redo スタック（immer + `Ctrl+Z` / `Ctrl+Y`、上限 100 段）
- コピー/ペースト（`Ctrl+C` / `Ctrl+V`、プレイヘッド基準の相対配置）
- `PropertyPanel` で選択マーカーの `soundId` / `variant` / `volume` / `pitch` 編集

### Phase 4: 連続再生 + カーブエディタ

**成果物**: 完全体。

- Marker に `duration`, `retriggerInterval`, `volumeCurve`, `pitchCurve` を UI 露出
- 連続モードのマーカーは Track 上で長方形（duration 幅）表示
- `CurveEditor` コンポーネント（SVG）
  - 折れ線描画、キーフレーム点、ハンドル
  - Shift+クリックで追加、ドラッグで移動、`T` で Linear/Bezier トグル、Delete で削除
  - Ease プリセット適用（右クリックメニュー）
- 再生エンジンにカーブサンプリング組込み（Linear / Bezier）
- リトリガー発火ロジック追加

## 7. テスト方針

- 各 Phase で **手動テスト** を必ず実施（`/verify` skill または `/run` skill を活用）
  - Phase 2: 保存 → 再読込で完全一致、再生タイミングが tick 通りかを目視/耳で確認
  - Phase 4: カーブに沿って音量/ピッチが変化することを耳で確認
- 単体テスト対象（テストフレームワーク未導入のため、Phase 1 で Vitest 導入判断）:
  - カーブサンプリング関数（Linear, Bezier の境界値）
  - Undo/Redo スタックの正当性
  - JSON バリデータ（`version`, `format`, スキーマ違反）

## 8. スコープ外（今回やらない）

- マルチレーン（複数トラック）
- ループ範囲再生
- ドラッグ&ドロップでの音源差し替え
- 自動保存 / セッション復元
- MRU（最近使ったファイル）
- リアルタイム波形表示
- 音源データのファイル埋め込み（`.kp` は参照のみ）

## 9. 既存機能との関係

- `useAudioLibrary`: そのまま流用（音源リストとハッシュ取得）
- `useAudioPlayV2`: 直接は使わず、`useTimelinePlayback` 内で AudioContext + AudioBuffer を直接操作
- メインウィンドウとの連携（現状の `mainSelectedId` 経由の「メイン選択IDで追加」）: Phase 1 で「新規マーカー追加時のデフォルト soundId」として引き続き活用
