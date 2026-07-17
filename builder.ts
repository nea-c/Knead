import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.neac.knead',
  productName: 'Knead',
  copyright: 'Copyright © 2025 ${author}',
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
    artifactName: '${productName}-${version}-windows-${arch}.${ext}',
    target: ['zip'],
    icon: 'build/icon.png',
  },
  mac: {
    artifactName: '${productName}-${version}-darwin-${arch}.${ext}',
    icon: 'build/icon.icns',
    target: ['dmg'],
    // コード署名しない場合は null の設定が必須
    identity: null,
  },
  linux: {
    artifactName: '${productName}-${version}-linux-${arch}.${ext}',
    icon: 'build/icon.png',
    target: ['AppImage'],
    category: 'Development',
  },
}

export default config
