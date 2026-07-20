import React, { useEffect, useState } from 'react'
import { SettingsIcon, ArrowDownAZIcon, FilterIcon } from '@yamada-ui/lucide'
import { Drawer, DrawerHeader, DrawerBody, useDisclosure, IconButton, Switch, Text, HStack, Card, CardHeader, CardBody, VStack, Spacer, ScrollArea } from '@yamada-ui/react'
import { ThemeChange } from './ThemeChange'
import { useTranslation } from 'react-i18next'
import { LanguageChange } from './LanguageChange'
import packageJson from '../../../package.json'

export const Configuration = () => {
  const { open, onOpen, onClose } = useDisclosure()

  const { t } = useTranslation()

  const [holdSoundsSort, setHoldSoundsSort] = useState<boolean>(false)
  const [holdRatingFilter, setHoldRatingFilter] = useState<boolean>(false)

  useEffect(() => {
    (async () => {
      const load_holdSoundsSort = await window.myAPI.getSetting('holdSoundsSort') as boolean
      setHoldSoundsSort(load_holdSoundsSort)
      const load_holdRatingFilter = await window.myAPI.getSetting('holdRatingFilter') as boolean
      setHoldRatingFilter(load_holdRatingFilter)
    })()
  }, [])

  const changesetHoldSoundsSort = (v: boolean) => {
    setHoldSoundsSort(v)
    window.myAPI.updateSettings({ holdSoundsSort: v })
  }

  const changeHoldRatingFilter = (v: boolean) => {
    setHoldRatingFilter(v)
    window.myAPI.updateSettings({ holdRatingFilter: v })
  }

  const appVersion = 'r' + packageJson.version

  return (
    <>
      <IconButton onClick={onOpen} icon={<SettingsIcon fontSize="xl" />} />

      <Drawer open={open} onClose={onClose} size="lg" placement="right" style={{ userSelect: 'none' }}>
        <DrawerHeader>
          <Text>{t('settings')}</Text>
        </DrawerHeader>

        <DrawerBody>

          <ScrollArea w="full" overflowY="scroll">
            <VStack gap={2}>
              <Card w="full" variant="outline">
                <LanguageChange />
              </Card>

              <Card w="full" variant="outline">
                <ThemeChange />
              </Card>

              <Card w="full" variant="outline">
                <CardHeader>
                  <HStack>
                    <ArrowDownAZIcon fontSize="xl" />
                    <Text>{t('sort')}</Text>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Switch checked={holdSoundsSort} onChange={() => changesetHoldSoundsSort(!holdSoundsSort)}>{t('hold_sounds_sort')}</Switch>
                </CardBody>
              </Card>

              <Card w="full" variant="outline">
                <CardHeader>
                  <HStack>
                    <FilterIcon fontSize="xl" />
                    <Text>{t('rating_filter')}</Text>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Switch checked={holdRatingFilter} onChange={() => changeHoldRatingFilter(!holdRatingFilter)}>{t('hold_rating_filter')}</Switch>
                </CardBody>
              </Card>

            </VStack>
          </ScrollArea>

          <Spacer h="full" />
          <HStack w="full">
            <Spacer />
            <Text>{appVersion}</Text>
          </HStack>

        </DrawerBody>

      </Drawer>
    </>
  )
}
