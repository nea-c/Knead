import React, { useEffect } from 'react'
import { useMantineColorScheme, Menu, ThemeIcon } from '@mantine/core'
import { LuMoon, LuPalette, LuSun, LuMonitorCog } from 'react-icons/lu'
import { useThemeDetector } from './hooks/useThemeDetectpr'
import { useAddDispatch, useAppSelector } from '../store/_store'
import { updateTheme } from '../store/fetchSlice'

export const ThemeChange = () => {
  const dispatch = useAddDispatch()

  const isSystemDarkTheme = useThemeDetector()

  const { setColorScheme } = useMantineColorScheme()
  const theme = useAppSelector(state => state.fetch.theme)

  const isSystemColor = (theme == 'system') ? 'primary' : ''
  const isLightColor = (theme == 'light') ? 'primary' : ''
  const isDarkColor = (theme == 'dark') ? 'primary' : ''

  useEffect(() => {
    if (theme == 'system') setColorScheme(isSystemDarkTheme ? 'dark' : 'light')
  }, [isSystemDarkTheme, setColorScheme, theme])

  const changeColorMode = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target_theme = e.currentTarget.value
    dispatch(updateTheme({ theme: target_theme }))

    if (target_theme === 'system') {
      setColorScheme(isSystemDarkTheme ? 'dark' : 'light')
    }
    else {
      setColorScheme(target_theme === 'light' ? 'light' : 'dark')
    }
  }

  return (

    <Menu trigger="hover">

      <Menu.Target>
        <ThemeIcon variant="outline" size="lg">
          <LuPalette />
        </ThemeIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<LuMonitorCog color={isSystemColor} />}
          color={isSystemColor}
          onClick={changeColorMode}
          value="system"
        >
          System
        </Menu.Item>
        <Menu.Item
          leftSection={<LuSun color={isLightColor} />}
          color={isLightColor}
          onClick={changeColorMode}
          value="light"
        >
          Light
        </Menu.Item>
        <Menu.Item
          leftSection={<LuMoon color={isDarkColor} />}
          color={isDarkColor}
          onClick={changeColorMode}
          value="dark"
        >
          Dark
        </Menu.Item>
      </Menu.Dropdown>

    </Menu>

  )
}
