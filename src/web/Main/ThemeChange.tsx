import React, { useEffect, useState } from 'react'
import { useColorMode, HStack, Text, SegmentedControlRoot as SegmentedControl, SegmentedControlItem as SegmentedControlButton, ColorModeWithSystem, CardBody, CardHeader } from '@yamada-ui/react'

import { MoonIcon, PaletteIcon, SunIcon, MonitorCogIcon } from '@yamada-ui/lucide'
import { useTranslation } from 'react-i18next'

export const ThemeChange = () => {
  const { changeColorMode } = useColorMode()
  const { t } = useTranslation()

  const [Theme, setTheme] = useState('system')

  const getColorModeWithSystem = (v: string): ColorModeWithSystem => {
    if (v == 'system') return 'system'
    if (v == 'light') return 'light'
    if (v == 'dark') return 'dark'
    return 'system'
  }

  useEffect(() => {
    (async () => {
      const theme = await window.myAPI.getSetting('theme') as string
      setTheme(theme ?? 'system')
    })()
  }, [changeColorMode])

  const changeTheme = (v: ColorModeWithSystem) => {
    window.myAPI.updateSettings({ theme: v })
    changeColorMode(v)
    setTheme(v)
  }

  return (
    <>
      <CardHeader>
        <HStack>
          <PaletteIcon fontSize="xl" />
          <Text>{t('theme_select')}</Text>
        </HStack>
      </CardHeader>
      <CardBody>
        <SegmentedControl value={Theme} onChange={v => changeTheme(getColorModeWithSystem(v))}>
          <SegmentedControlButton value="system">
            <HStack>
              <MonitorCogIcon fontSize="xl" />
              <Text>System</Text>
            </HStack>
          </SegmentedControlButton>
          <SegmentedControlButton value="light">
            <HStack>
              <SunIcon fontSize="xl" />
              <Text>Light</Text>
            </HStack>
          </SegmentedControlButton>
          <SegmentedControlButton value="dark">
            <HStack>
              <MoonIcon fontSize="xl" />
              <Text>Dark</Text>
            </HStack>
          </SegmentedControlButton>
        </SegmentedControl>
      </CardBody>
    </>
  )
}
