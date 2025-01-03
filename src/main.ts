import path from 'node:path'
import { BrowserWindow, app } from 'electron'
import { initIpcMain } from './ipc-main-handler'

initIpcMain()

app.whenReady().then(() => {
  // アプリの起動イベント発火で BrowserWindow インスタンスを作成
  const mainWindow = new BrowserWindow({
    width: 950,
    height: 790 + 40,
    minWidth: 650,
    minHeight: 650,
    frame: true,
    center: true,
    title: 'Knead',
    opacity: 1,
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
})

// すべてのウィンドウが閉じられたらアプリを終了する
app.once('window-all-closed', () => app.quit())
