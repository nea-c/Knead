console.log('preloaded!')

import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('myAPI', {
  get_versions: () => ipcRenderer.invoke('get_versions'),
  get_mcSounds: (version: string) => ipcRenderer.invoke('get_mcSounds', version),
  get_mcSoundHash: (hash: string) => ipcRenderer.invoke('get_mcSoundHash', hash),
  make_sub_window: () => ipcRenderer.invoke('make_sub_window'),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  updateSettings: (partial: string | number | boolean) => ipcRenderer.send('settings:update', partial),
  getSetting: (key: string): Promise<string | number | boolean> => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string | number | boolean) => ipcRenderer.send('settings:set', { key, value }),
  loadRatingStar: async (): Promise<{ [key: string]: number }> => { return await ipcRenderer.invoke('load-rating-star') },
  saveRatingStar: async (data: string): Promise<void> => { await ipcRenderer.invoke('save-rating-star', data) },
  saveRatingStarAsString: async (data: string): Promise<void> => { await ipcRenderer.invoke('save-rating-star-as-string', data) },
  updateRatingStar: async (key: string, value: number): Promise<void> => { await ipcRenderer.invoke('update-rating-star', key, value) },
  getCurrentSounds: () => ipcRenderer.invoke('getCurrentSounds'),
  getMainSelectedSound: () => ipcRenderer.invoke('get_main_selected_sound'),
  setSelectedSound: (id: string) => ipcRenderer.send('set_selected_sound', id),
})
