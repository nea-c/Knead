import { VersionInfoType } from './VersionInfo'

export interface SoundSort {
  id: string
  rating: string
}

export type SettingType = string | number | number[] | boolean | SoundSort | VersionInfoType | null | undefined
