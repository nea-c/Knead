import {
  SINGLE_SHOT_CURVE_PREVIEW_TICKS,
  TIMELINE_MARKER_SIZE,
  type Keyframe,
  type Marker,
  type TimelineFile,
  type TimelineState,
} from '../types/timeline'

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

function validateHandle(x: unknown): boolean {
  if (!isObj(x)) return false
  return typeof x.dt === 'number'
    && Number.isFinite(x.dt)
    && typeof x.dv === 'number'
    && Number.isFinite(x.dv)
}

function validateKeyframe(x: unknown): x is Keyframe {
  if (!isObj(x)) return false
  if (typeof x.tick !== 'number' || !Number.isInteger(x.tick) || x.tick < 0) return false
  if (typeof x.value !== 'number' || !Number.isFinite(x.value)) return false
  if (x.interpolation !== 'linear' && x.interpolation !== 'bezier') return false
  if (x.handleL !== undefined && !validateHandle(x.handleL)) return false
  if (x.handleR !== undefined && !validateHandle(x.handleR)) return false
  return true
}

function validateCurve(
  x: unknown,
  duration: number,
  valueMin: number,
  valueMax: number,
): string | null {
  if (!isObj(x) || !Array.isArray(x.keyframes)) return 'keyframes が配列ではありません'
  if (x.keyframes.length === 0) return 'keyframes が空です'

  let previousTick = -1
  for (let i = 0; i < x.keyframes.length; i++) {
    const keyframe = x.keyframes[i]
    if (!validateKeyframe(keyframe)) return 'keyframes[' + i + '] の形式が不正です'
    if (keyframe.tick <= previousTick) return 'keyframes が tick 昇順ではありません'
    if (keyframe.tick > duration) return 'keyframes[' + i + '].tick が duration を超えています'
    if (keyframe.value < valueMin || keyframe.value > valueMax) {
      return 'keyframes[' + i + '].value が範囲外です'
    }
    previousTick = keyframe.tick
  }
  return null
}

function validateMarker(x: unknown, lengthTicks: number): string | null {
  if (!isObj(x)) return 'オブジェクトではありません'
  if (typeof x.id !== 'string' || x.id.length === 0) return 'id が空です'
  if (typeof x.tick !== 'number' || !Number.isInteger(x.tick) || x.tick < 0 || x.tick >= lengthTicks) {
    return 'tick がタイムライン範囲外です'
  }
  if (typeof x.soundId !== 'string') return 'soundId が文字列ではありません'
  if (typeof x.variantIndex !== 'number' || !Number.isInteger(x.variantIndex) || x.variantIndex < -1) {
    return 'variantIndex が不正です'
  }
  if (typeof x.volume !== 'number' || !Number.isFinite(x.volume) || x.volume < 0 || x.volume > 1) {
    return 'volume が 0..1 の範囲外です'
  }
  if (typeof x.pitch !== 'number' || !Number.isFinite(x.pitch) || x.pitch < 0.5 || x.pitch > 2) {
    return 'pitch が 0.5..2 の範囲外です'
  }
  if (
    x.duration !== undefined
    && (typeof x.duration !== 'number' || !Number.isInteger(x.duration) || x.duration < 0)
  ) {
    return 'duration が不正です'
  }
  if (
    x.retriggerInterval !== undefined
    && (
      typeof x.retriggerInterval !== 'number'
      || !Number.isInteger(x.retriggerInterval)
      || x.retriggerInterval <= 0
    )
  ) {
    return 'retriggerInterval が正の整数ではありません'
  }

  if (
    x.trackY !== undefined
    && (
      typeof x.trackY !== 'number'
      || !Number.isFinite(x.trackY)
      || x.trackY < TIMELINE_MARKER_SIZE / 2
    )
  ) {
    return 'trackY が不正です'
  }

  const duration = typeof x.duration === 'number' && x.duration > 0
    ? x.duration
    : SINGLE_SHOT_CURVE_PREVIEW_TICKS
  if (x.volumeCurve !== undefined) {
    const error = validateCurve(x.volumeCurve, duration, 0, 1)
    if (error) return 'volumeCurve: ' + error
  }
  if (x.pitchCurve !== undefined) {
    const error = validateCurve(x.pitchCurve, duration, 0.5, 2)
    if (error) return 'pitchCurve: ' + error
  }
  return null
}

export function parse(json: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  }
  catch (e) {
    return { ok: false, error: 'JSON パース失敗: ' + (e as Error).message }
  }
  if (!isObj(raw)) return { ok: false, error: 'ルートがオブジェクトではありません' }
  if (raw.format !== 'knead-project') {
    return { ok: false, error: `format が 'knead-project' ではありません (got: ${JSON.stringify(raw.format)})` }
  }
  if (raw.version !== 1) {
    return { ok: false, error: 'version ' + JSON.stringify(raw.version) + ' は未対応です (対応: 1)' }
  }
  if (typeof raw.targetVersion !== 'string') return { ok: false, error: 'targetVersion が文字列ではありません' }
  if (
    typeof raw.lengthTicks !== 'number'
    || !Number.isInteger(raw.lengthTicks)
    || raw.lengthTicks < 1
  ) {
    return { ok: false, error: 'lengthTicks が正の整数ではありません' }
  }
  if (!Array.isArray(raw.markers)) return { ok: false, error: 'markers が配列ではありません' }

  const ids = new Set<string>()
  for (let i = 0; i < raw.markers.length; i++) {
    const marker = raw.markers[i]
    const error = validateMarker(marker, raw.lengthTicks)
    if (error) return { ok: false, error: 'markers[' + i + ']: ' + error }
    if (ids.has(marker.id)) return { ok: false, error: 'markers[' + i + ']: id が重複しています' }
    ids.add(marker.id)
  }

  return {
    ok: true,
    state: {
      targetVersion: raw.targetVersion,
      lengthTicks: raw.lengthTicks,
      markers: raw.markers as Marker[],
    },
    warnings: [],
  }
}
export function _selfCheckTimelineIO(): void {
  // 往路テスト
  const state: TimelineState = {
    targetVersion: '1.21.4',
    lengthTicks: 100,
    markers: [
      { id: 'a', tick: 10, soundId: 'block.note_block.pling', variantIndex: -1, volume: 1, pitch: 1 },
      { id: 'b', tick: 50, soundId: 'ambient.cave', variantIndex: 0, volume: 0.5, pitch: 1.5, duration: 20, retriggerInterval: 5, trackY: 24 },
    ],
  }
  const json = serialize(state)
  const result = parse(json)
  if (!result.ok) throw new Error(`往復パース失敗: ${result.error}`)
  if (result.state.markers.length !== 2) throw new Error(`marker 数不一致`)
  if (result.state.markers[1].duration !== 20) throw new Error(`duration 消失`)
  if (result.state.markers[1].trackY !== 24) throw new Error(`trackY 消失`)

  // format 違い拒否
  const badFormat = parse(JSON.stringify({ format: 'other', version: 1, targetVersion: '', lengthTicks: 1, markers: [] }))
  if (badFormat.ok) throw new Error(`format 違いを受け入れてしまった`)

  // version 拒否
  const badVer = parse(JSON.stringify({ format: 'knead-project', version: 2, targetVersion: '', lengthTicks: 1, markers: [] }))
  if (badVer.ok) throw new Error(`version 2 を受け入れてしまった`)

  // 壊れた marker が 1 件でもあれば、部分読込せず全体を拒否する
  const withBad = parse(JSON.stringify({
    format: 'knead-project', version: 1, targetVersion: '', lengthTicks: 100,
    markers: [
      { id: 'ok', tick: 0, soundId: '', variantIndex: -1, volume: 1, pitch: 1 },
      { id: 'bad', tick: -5, soundId: '', variantIndex: -1, volume: 1, pitch: 1 },
    ],
  }))
  if (withBad.ok) throw new Error('不正マーカーを含むファイルを受け入れてしまった')

  const duplicateId = parse(JSON.stringify({
    format: 'knead-project', version: 1, targetVersion: '', lengthTicks: 100,
    markers: [
      { id: 'same', tick: 0, soundId: '', variantIndex: -1, volume: 1, pitch: 1 },
      { id: 'same', tick: 1, soundId: '', variantIndex: -1, volume: 1, pitch: 1 },
    ],
  }))
  if (duplicateId.ok) throw new Error('重複 marker id を受け入れてしまった')

  const badCurve = parse(JSON.stringify({
    format: 'knead-project', version: 1, targetVersion: '', lengthTicks: 100,
    markers: [{
      id: 'curve', tick: 0, soundId: '', variantIndex: -1, volume: 1, pitch: 1,
      duration: 20,
      volumeCurve: {
        keyframes: [
          { tick: 10, value: 1, interpolation: 'linear' },
          { tick: 5, value: 0.5, interpolation: 'linear' },
        ],
      },
    }],
  }))
  if (badCurve.ok) throw new Error('tick 順が不正なカーブを受け入れてしまった')
  console.log('timelineIO self-check OK')
}
