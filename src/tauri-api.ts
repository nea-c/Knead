import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { Sandbox } from '../@types/global'

const invokeVoid = async (command: string, args?: Record<string, unknown>): Promise<void> => {
  await invoke(command, args)
}

const api: Sandbox = {
  get_versions: () => invoke<{ id: string, downloaded: boolean }[]>('get_versions'),
  downloadVersionAssets: version => invoke('download_version_assets', { version }),
  get_mcSounds: version => invoke('get_mc_sounds', { version }),
  get_mcSoundHash: async (hash) => {
    const path = await invoke<string>('get_mc_sound_hash', { hash })
    return path === '' ? '' : convertFileSrc(path)
  },
  get_mcSoundData: async (hash) => {
    const data = await invoke<ArrayBuffer | Uint8Array | number[]>('get_mc_sound_data', { hash })
    if (data instanceof ArrayBuffer) return data
    return Uint8Array.from(data).buffer
  },
  make_sub_window: () => {
    void invokeVoid('make_sub_window')
  },
  loadSettings: () => invoke('load_settings'),
  updateSettings: (partial) => {
    void invokeVoid('update_settings', { partial })
  },
  getSetting: key => invoke('get_setting', { key }),
  setSetting: (key, value) => {
    void invokeVoid('set_setting', { key, value })
  },
  loadRatingStar: () => invoke('load_rating_star'),
  saveRatingStar: data => invokeVoid('save_rating_star', { data }),
  saveRatingStarAsString: data => invokeVoid('save_rating_star_as_string', { data }),
  updateRatingStar: (key, value) => invokeVoid('update_rating_star', { key, value }),
  getCurrentSounds: () => invoke('get_current_sounds'),
  setSelectedSound: (id) => {
    void invokeVoid('set_selected_sound', { id })
  },
  getMainSelectedSound: () => invoke('get_main_selected_sound'),
  timeline: {
    save: json => invoke('timeline_save', { json }),
    saveDialog: (defaultPath, json) => invoke('timeline_save_dialog', { defaultPath, json }),
    openDialog: () => invoke('timeline_open_dialog'),
    openPath: path => invoke('timeline_open_path', { path }),
    setCurrentPath: path => invoke('timeline_set_current_path', { path }),
    takeOpenRequest: () => invoke('timeline_take_open_request'),
    onOpenRequested: handler => listen('timeline-open-requested', handler),
    onDragDrop: handler => getCurrentWindow().onDragDropEvent(event => handler(event.payload)),
  },
}

window.myAPI = api
