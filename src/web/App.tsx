import './App.css'
import React, { useEffect } from 'react'
import { VersionSelector } from './VersionSelector'
import { SoundSelector } from './SoundSelector'
import { ThemeChange } from './ThemeChange'
import { Footer } from './Footer'
import { Configuration } from './Configuration'
import { VolumeChange } from './VolumeChange'
import { LanguageChange } from './LanguageChange'
import { useAppSelector } from '../store/_store'
import { Divider, Flex, Space, Container, Stack, Group, useComputedColorScheme } from '@mantine/core'
import { useColorScheme } from '@mantine/hooks'

const { myAPI } = window

export const App = () => {
  const targetVersion = useAppSelector(state => state.fetch.targetVersion)?.raw
  const soundRatings = useAppSelector(state => state.fetch.soundRatings)
  const volumeSlider = useAppSelector(state => state.fetch.volumeSlider)

  useEffect(() => {
    (async () => {
      try {
        // const loaded = await myAPI.load()
      }
      catch (e: unknown) {
        alert(e)
      }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      try {
        await myAPI.save(JSON.stringify({ volume: volumeSlider }), JSON.stringify(soundRatings), JSON.stringify({ version: targetVersion }))
      }
      catch (e: unknown) {
        alert(e)
      }
    })()
  }, [soundRatings, targetVersion, volumeSlider])

  const themeOf = useComputedColorScheme('light', { getInitialValueInEffect: true })

  const style = document.createElement('style')
  style.textContent += '::-webkit-scrollbar { width: 7px; height: 7px; }'
  if (themeOf === 'light') {
    style.textContent += '::-webkit-scrollbar-track { background: var(--ui-colors-blackAlpha-200); border: none; }'
    style.textContent += '::-webkit-scrollbar-thumb { background: var(--ui-colors-blackAlpha-600); border-radius: 10px; }'
  }
  if (themeOf === 'dark') {
    style.textContent += '::-webkit-scrollbar-track { background: var(--ui-colors-whiteAlpha-200); border: none; }'
    style.textContent += '::-webkit-scrollbar-thumb { background: var(--ui-colors-whiteAlpha-600); border-radius: 10px; }'
  }
  document.head.appendChild(style)

  return (
    <>
      <Stack>
        <Container p={7} w="100vw" h="100vh">
          <Group justify="space-between">
            <VersionSelector />
            <Group justify="flex-end" gap="xs">
              <VolumeChange />
              <LanguageChange />
              <ThemeChange />
              {/* <Configuration /> */}
            </Group>
          </Group>
          <Divider my={7} size="xs" />
          <SoundSelector />
        </Container>
        <Footer />
      </Stack>
    </>
  )
}
