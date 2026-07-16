import { SettingType } from '../src/config'
import { Sound } from '../src/store/fetchSlice'

declare global {
  interface Window {
    myAPI: Sandbox
  }
}

export interface Sandbox {
  get_versions: () => Promise<string[]>
  get_mcSounds: (version: string) => Promise<Sound[]>
  get_mcSoundHash: (hash: string) => Promise<string>
  make_sub_window: () => void
  loadSettings: () => Promise<SettingType>
  updateSettings: (partial: Record<string, SettingType>) => void
  getSetting: <Key extends string>(key: Key) => Promise<SettingType>
  setSetting: <Key extends string>(key: Key, value: SettingType) => void
  loadRatingStar: () => Promise<{ [key: string]: number }>
  saveRatingStar: (data: string) => Promise<void>
  saveRatingStarAsString: (data: string) => Promise<void>
  updateRatingStar: (key: string, value: number) => Promise<void>
  getCurrentSounds: () => Promise<Sound[]>
  setSelectedSound: (id: string) => void
  getMainSelectedSound: () => Promise<string>
  timeline: {
    saveDialog: (
      defaultPath: string | undefined,
      json: string,
    ) => Promise<{ ok: true, path: string } | { ok: false, canceled: true } | { ok: false, error: string }>
    openDialog: () => Promise<{ ok: true, path: string, json: string } | { ok: false, canceled: true } | { ok: false, error: string }>
  }
}
