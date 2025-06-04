import React, { useEffect, useState } from 'react'
import { VersionSelector } from '../Main/VersionSelector'
import { SoundSelector } from '../Main/SoundSelector'
import { Footer } from '../Main/Footer'
import { Configuration } from '../Main/Configuration'
import { VolumeChange } from '../Main/VolumeChange'
import { Separator, Flex, Spacer, Box, VStack, Button, useColorMode, ColorModeWithSystem } from '@yamada-ui/react'

export const App = () => {
  const openSubWindow = () => {
    window.myAPI.make_sub_window()
  }

  const { changeColorMode } = useColorMode()
  const [themeLoadOnce, setThemeLoadOnce] = useState(false)

  const getColorModeWithSystem = (v: string): ColorModeWithSystem => {
    if (v == 'system') return 'system'
    if (v == 'light') return 'light'
    if (v == 'dark') return 'dark'
    return 'system'
  }

  useEffect(() => {
    if (!themeLoadOnce) {
      (async () => {
        const theme = await window.myAPI.getSetting('theme') as string
        changeColorMode(getColorModeWithSystem(theme ?? 'system'))
      })()
      setThemeLoadOnce(true)
    }
  }, [changeColorMode, themeLoadOnce])

  return (
    <>
      <VStack h="100vh">
        <Box padding={2}>
          <Flex w="full" gap={2} paddingBottom={0}>
            <VersionSelector />

            <Spacer />

            <VolumeChange />
            <Button onClick={openSubWindow}>test</Button>
            <Configuration />
          </Flex>
          <Separator marginY={2} size="xs" />
          <SoundSelector />
        </Box>
        <Footer />
      </VStack>
    </>
  )
}
