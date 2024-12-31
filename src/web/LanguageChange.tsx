import React from 'react'
import { Menu, Box, ThemeIcon } from '@mantine/core'

import { LuCheck, LuGlobe } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'
import { useAddDispatch } from '../store/_store'
import { updateLanguage } from '../store/fetchSlice'

export const LanguageChange = () => {
  const { i18n } = useTranslation()
  const dispatch = useAddDispatch()

  const onClickLang = (lang: string) => {
    i18n.changeLanguage(lang)
    dispatch(updateLanguage({ lang }))
  }

  return (
    <Menu trigger="hover">
      <Menu.Target>
        <ThemeIcon variant="outline" size="lg">
          <LuGlobe />
        </ThemeIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<LuCheck opacity={i18n.language === 'en' ? 1 : 0} />}
          onClick={() => onClickLang('en')}
        >
          English
        </Menu.Item>
        <Menu.Item
          leftSection={<LuCheck opacity={i18n.language === 'ja' ? 1 : 0} />}
          onClick={() => i18n.changeLanguage('ja')}
        >
          日本語
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
