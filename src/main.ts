import path from 'node:path'
import { BrowserWindow, app, ipcMain } from 'electron'
import { initIpcMain } from './ipc-main-handler'
import { initAutoUpdateChecker } from './update-checker'
import { Sound } from './store/fetchSlice'

initIpcMain()

let mainWindow: BrowserWindow
let currentSounds = []

const createMainWindow = () => {
  initAutoUpdateChecker()
  mainWindow = new BrowserWindow({
    width: 950,
    height: 790 + 40,
    minWidth: 650,
    minHeight: 650,
    frame: true,
    center: true,
    title: 'Knead',
    opacity: 1,
    show: false,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      // webpack が出力したプリロードスクリプトを読み込み
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  // メニューバー削除
  mainWindow.setMenu(null)
  // レンダラープロセスをロード
  mainWindow.loadFile('dist/index.html')
  if (process.env.NODE_ENV == 'development') mainWindow.webContents.openDevTools()

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

const createSubWindow = () => {
  const subWindow = new BrowserWindow({
    width: 950,
    height: 650 + 40,
    minWidth: 650,
    minHeight: 650,
    frame: true,
    title: 'Knead',
    parent: mainWindow,
    opacity: 1,
    show: false,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // メニューバー削除
  subWindow.setMenu(null)
  // レンダラープロセスをロード
  subWindow.loadFile('dist/index.html', { hash: 'sub' })
  if (process.env.NODE_ENV == 'development') subWindow.webContents.openDevTools()

  subWindow.once('ready-to-show', () => {
    subWindow.show()
  })

  subWindow.once('closed', () => mainWindow.focus())
}

export const setCurrentSounds = (sounds: Sound[]) => {
  currentSounds = sounds
}

app.on('ready', () => {
  // 多重起動禁止
  if (!app.requestSingleInstanceLock()) app.quit()
  // メインウインドウ作成
  createMainWindow()

  // サブウインドウを作成するハンドラ
  ipcMain.handle('make_sub_window', (): void => {
    // 子ウィンドウを作成
    createSubWindow()
  })
})

// すべてのウィンドウが閉じられたらアプリを終了する
app.once('window-all-closed', () => app.quit())

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus() // 既存のウィンドウにフォーカスを当てる
  }
})
