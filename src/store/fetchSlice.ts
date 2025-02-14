import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { VersionInfoType } from '../types/VersionInfo'

export interface Sound {
  id: string
  sounds: SoundName[]
}

export interface SoundName {
  path: string
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
}

export const fetchSlice = createSlice({
  name: 'fetch',
  initialState,
  reducers: {

    updateTargetVersion: (
      state,
      action: PayloadAction<{ targetVersion: VersionInfoType | undefined }>,
    ) => {
      state.targetVersion = action.payload.targetVersion
    },

    updateSoundList: (
      state,
      action: PayloadAction<{ sounds: Sound[] }>,
    ) => {
      state.sounds = action.payload.sounds
    },

    updateSelectedSound: (
      state,
      action: PayloadAction<{ id: string }>,
    ) => {
      state.selectedSound = action.payload.id
      state.soundSelectDetector = state.soundSelectDetector ? false : true
    },

  },
})
export default fetchSlice.reducer
export const { updateTargetVersion, updateSoundList, updateSelectedSound } = fetchSlice.actions
