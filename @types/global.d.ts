import { Sound } from '../src/store/fetchSlice'
import { SettingType } from '../src/types/Settings'

export type ProjectDragDropEvent =
  | { type: 'enter', paths: string[] }
  | { type: 'over' }
  | { type: 'drop', paths: string[] }
  | { type: 'leave' }

export type TimelineOpenResult =
  | { ok: true, path: string, json: string }
  | { ok: false, canceled: true }
  | { ok: false, error: string }

declare global {
  interface Window {
    myAPI: Sandbox
  }
}

export interface Sandbox {
  get_versions: () => Promise<{ id: string, downloaded: boolean }[]>
  downloadVersionAssets: (version: string) => Promise<{
    version: string
    assetIndex: string
    downloadedAssets: number
    reusedAssets: number
  }>
  get_mcSounds: (version: string) => Promise<Sound[]>
  get_mcSoundHash: (hash: string) => Promise<string>
  get_mcSoundData: (hash: string) => Promise<ArrayBuffer>
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
    save: (
      json: string,
    ) => Promise<{ ok: true, path: string } | { ok: false, error: string }>
    saveDialog: (
      defaultPath: string | undefined,
      json: string,
    ) => Promise<{ ok: true, path: string } | { ok: false, canceled: true } | { ok: false, error: string }>
    openDialog: () => Promise<TimelineOpenResult>
    openPath: (path: string) => Promise<TimelineOpenResult>
    setCurrentPath: (path: string) => Promise<{ ok: true, path: string } | { ok: false, error: string }>
    takeOpenRequest: () => Promise<string | null>
    onOpenRequested: (handler: () => void) => Promise<() => void>
    onDragDrop: (handler: (event: ProjectDragDropEvent) => void) => Promise<() => void>
  }
}
