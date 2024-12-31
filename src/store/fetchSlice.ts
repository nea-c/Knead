import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { VersionInfoType } from '../types/VersionInfo'

export interface Sound {
  id: string
  sounds: SoundName[]
}

export interface SoundName {
  hash: string
  pitch: number
}

interface State {
  targetVersion: VersionInfoType | undefined
  sounds: Sound[]
  soundRatings: { [key: string]: number }
  selectedSound: string
  soundSelectDetector: boolean
  volumeSlider: number
  appVolume: number
  appMute: boolean
  lang: string
  theme: string
}

const initialState: State = {
  targetVersion: undefined,
  sounds: [],
  soundRatings: {},
  selectedSound: '',
  soundSelectDetector: false,
  volumeSlider: 1,
  appVolume: 1,
  appMute: false,
  lang: 'ja',
  theme: 'system',
}

export const fetchSlice = createSlice({
  name: 'fetch',
  initialState,
  reducers: {

    updateTargetVersion: (
      state,
      action: PayloadAction<{ version: VersionInfoType | undefined }>,
    ) => {
      state.targetVersion = action.payload.version
    },

    updateSoundList: (
      state,
      action: PayloadAction<{ sounds: Sound[] }>,
    ) => {
      state.sounds = action.payload.sounds
    },

    updateSoundRating: (
      state,
      action: PayloadAction<{ soundRatings: { [key: string]: number } }>,
    ) => {
      state.soundRatings = action.payload.soundRatings
    },

    updateSelectedSound: (
      state,
      action: PayloadAction<{ id: string }>,
    ) => {
      state.selectedSound = action.payload.id
      state.soundSelectDetector = state.soundSelectDetector ? false : true
    },

    updateAppVolume: (
      state,
      action: PayloadAction<{ volume: number, mute: boolean }>,
    ) => {
      state.volumeSlider = action.payload.volume
      state.appMute = action.payload.mute
      state.appVolume = state.appMute ? 0 : state.volumeSlider
    },

    updateLanguage: (
      state,
      action: PayloadAction<{ lang: string }>,
    ) => {
      state.lang = action.payload.lang
    },

    updateTheme: (
      state,
      action: PayloadAction<{ theme: string }>,
    ) => {
      state.theme = action.payload.theme
    },

  },
})
export default fetchSlice.reducer
export const { updateTargetVersion, updateSoundList, updateSoundRating, updateSelectedSound, updateAppVolume, updateLanguage, updateTheme } = fetchSlice.actions
