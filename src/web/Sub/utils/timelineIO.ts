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
  // 往路テスト
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
