import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { VersionInfoType } from './types/VersionInfo'

export interface SoundSort {
  id: string
  rating: string
}

export type SettingType = string | number | number[] | boolean | SoundSort | VersionInfoType | undefined

export interface KneadSettings {
  volume: number
  language: string
  theme: string
  selectedVersion: VersionInfoType | undefined
  playbackCategory: string
  holdSoundsSort: boolean
  holdRatingFilter: boolean
  lastSoundsSort: SoundSort
  lastRatingFilter: number[]
  [key: string]: SettingType
}

export interface RatingStar {
  [key: string]: number
}

export const defaultSettings: KneadSettings = {
  volume: 0.5,
  language: 'en',
  theme: 'system',
  selectedVersion: undefined,
  playbackCategory: 'master',
  holdSoundsSort: false,
  holdRatingFilter: false,
  lastSoundsSort: { id: 'ascending', rating: 'none' },
  lastRatingFilter: [],
}

export const defaultRatingStar: RatingStar = {}

/**
 * 設定ファイル配置場所
 */
const userData = app.getPath('userData')
const configPath = path.join(userData, 'settings.json')
const ratingStarPath = path.join(userData, 'ratingStar.json')
console.log(process.env.PORTABLE_EXECUTABLE_DIR)

/**
 * 各設定ファイルを読み込む関数
 */
export const loadSettings = (): KneadSettings => {
  try {
    //フォルダ自体が存在しないなら作成
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true })
    }

    if (!fs.existsSync(configPath)) {
      // ファイルがなければデフォルトを書き込み
      fs.mkdirSync(userData, { recursive: true })
      console.log('default settings')
      fs.writeFileSync(configPath, JSON.stringify(defaultSettings, null, 2))
      return defaultSettings
    }
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<KneadSettings>
    return {
      ...defaultSettings,
      ...parsed,
    } as KneadSettings
  }
  catch (err) {
    console.error('[loadSettings] Failed:', err)
    return defaultSettings
  }
}

export const loadRatingStar = (): RatingStar => {
  try {
    if (!fs.existsSync(ratingStarPath)) {
      fs.mkdirSync(userData, { recursive: true })
      saveRatingStar(defaultRatingStar)
      return defaultRatingStar
    }
    const raw = fs.readFileSync(ratingStarPath, 'utf-8')
    return JSON.parse(raw) as RatingStar
  }
  catch (err) {
    console.error('[loadRatingStar] Failed:', err)
    return defaultRatingStar
  }
}

/**
 * 指定されたキーの値を取得する関数
 */
export const getSetting = <Key extends keyof KneadSettings>(key: Key): KneadSettings[Key] => {
  const settings = loadSettings()
  return settings[key]
}

/**
 * 設定ファイルに指定されたキーの値を書き込む関数
 */
export const setSetting = <Key extends keyof KneadSettings>(key: Key, value: KneadSettings[Key]): void => {
  const settings = loadSettings()
  settings[key] = value
  try {
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2))
  }
  catch (err) {
    console.error('[setSetting] Failed:', err)
  }
}

/**
 * 各設定ファイルに書き込む関数
 */
export const saveSettings = (settings: KneadSettings) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2))
  }
  catch (err) {
    console.error('[saveSettings] Failed:', err)
  }
}

export const saveRatingStar = (ratingStar: RatingStar) => {
  try {
    fs.writeFileSync(ratingStarPath, JSON.stringify(ratingStar, null, 2))
  }
  catch (err) {
    console.error('[saveRatingStar] Failed:', err)
  }
}

export const saveRatingStarAsString = (ratingStar: string): void => {
  try {
    fs.writeFileSync(ratingStarPath, ratingStar, 'utf-8')
  }
  catch (err) {
    console.error('[saveRatingStarAsString] Failed:', err)
  }
}

export const updateRatingStar = (key: string, value: number): void => {
  const ratingStar = loadRatingStar()
  ratingStar[key] = value
  saveRatingStar(ratingStar)
}
