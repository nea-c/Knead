import React, { useEffect } from 'react'
import { SegmentedControlRoot as SegmentedControl, SegmentedControlItem as SegmentedControlButton, HStack, Text, Card } from '@yamada-ui/react'

import { GlobeIcon } from '@yamada-ui/lucide'
import { useTranslation } from 'react-i18next'

export const LanguageChange = () => {
  const { i18n } = useTranslation()

  useEffect(() => {}, [i18n])

  const onClickLang = (lang: string) => {
    i18n.changeLanguage(lang)
    window.myAPI.updateSettings({ language: lang })
  }

  return (
    <Card.Root>
      <Card.Header>
        <HStack>
          <GlobeIcon fontSize="xl" />
          <Text>Language / 言語</Text>
        </HStack>
      </Card.Header>
      <Card.Body>
        <SegmentedControl value={i18n.language} onChange={onClickLang}>
          <SegmentedControlButton value="en">English</SegmentedControlButton>
          <SegmentedControlButton value="ja">日本語</SegmentedControlButton>
        </SegmentedControl>
      </Card.Body>
    </Card.Root>
  )
}
