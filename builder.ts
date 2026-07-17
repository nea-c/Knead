import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.neac.knead',
  productName: 'Knead',
  copyright: 'Copyright © 2025 ${author}',
  artifactName: '${productName}-${version}-${arch}.${ext}',
  files: ['dist/**/*'],
  directories: {
    output: 'release',
  },
  icon: 'build/icon.png',
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  win: {
    target: ['zip'],
    icon: 'build/icon.png',
  },
  mac: {
    icon: 'build/icon.icns',
    target: ['dmg'],
    // コード署名しない場合は null の設定が必須
    identity: null,
  },
  linux: {
    icon: 'build/icon.icns',
    target: ['AppImage'],
    category: 'Development',
  },
}

export default config
