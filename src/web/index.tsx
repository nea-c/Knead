import React from 'react'
import './Style.css'
import { App } from './Main/App'
import { AppInitialize } from './AppInitialize'
import { SubApp } from './Sub/App'
import { createRoot } from 'react-dom/client'
import { COLOR_MODE_STORAGE_KEY, extendConfig, extendTheme, getStorageScript, ThemeConfig, UIProvider } from '@yamada-ui/react'
import { HashRouter, Routes, Route } from 'react-router'
import { store } from '../store/_store'
import { Provider } from 'react-redux'
import './i18n/configs'
import '../tauri-api'

export const config: ThemeConfig = {
  defaultColorMode: 'system',
}

const customConfig = extendConfig(config)

const customTheme = extendTheme({
  semanticTokens: {
    colors: {
      black: ['#141414', '#1f1f1f'],
      white: ['#f8f8f8', '#cccccc'],
      footerBackground: ['#ffffff', '#181818'],
    },
  },
})

const injectColorModeScript = () => {
  const getColorModeScript = getStorageScript('colorMode', COLOR_MODE_STORAGE_KEY)
  const scriptContent = getColorModeScript({ defaultValue: config.defaultColorMode })
  const script = document.createElement('script')

  script.textContent = scriptContent

  document.head.appendChild(script)
}

injectColorModeScript()

const isSubWindow = window.location.pathname.endsWith('/sub.html')

createRoot(document.getElementById('root') as Element).render(
  <Provider store={store}>
    <UIProvider config={customConfig} theme={customTheme}>
      <AppInitialize />
      {isSubWindow
        ? <SubApp />
        : (
            <HashRouter>
              <Routes>
                <Route index element={<App />} />
                <Route path="sub" element={<SubApp />} />
              </Routes>
            </HashRouter>
          )}
    </UIProvider>
  </Provider>,
)
