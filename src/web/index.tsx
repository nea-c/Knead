import '@mantine/core/styles.css'
import React from 'react'
import { App } from './App'
import { createRoot } from 'react-dom/client'
import { createTheme, MantineProvider } from '@mantine/core'

import { store } from '../store/_store'
import { Provider } from 'react-redux'
import './i18n/configs'

const customTheme = createTheme({
  // semantics: {
  //   colors: {
  //     black: ['#141414', '#1f1f1f'],
  //     white: ['#f8f8f8', '#cccccc'],
  //     footerBackground: ['#ffffff', '#181818'],
  //   },
  // },
})

createRoot(document.getElementById('root') as Element).render(
  <Provider store={store}>
    <MantineProvider defaultColorScheme="auto" theme={customTheme}>
      <App />
    </MantineProvider>
  </Provider>,
)
