import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAddDispatch, useAppSelector } from '../store/_store'
import { ActionIcon, Box, Container, Flex, Group, Input, Space } from '@mantine/core'
import { LuFilter, LuFilterX, LuSearch } from 'react-icons/lu'
import { useVirtualScroll } from './hooks/useVirtualScroll'
import { RatingStars } from './RatingStars'
import { updateSelectedSound, updateSoundRating } from '../store/fetchSlice'
import { useWindowSize } from './hooks/useWindowSize'
import { useTranslation } from 'react-i18next'
import { useDisclosure } from '@mantine/hooks'

export const SoundSelector = () => {
  const dispatch = useAddDispatch()
  const { t } = useTranslation()

  const Sounds = useAppSelector(state => state.fetch.sounds)
  const soundRatings = useAppSelector(state => state.fetch.soundRatings)
  const targetVersion = useAppSelector(state => state.fetch.targetVersion)?.raw
  const selectedSound = useAppSelector(state => state.fetch.selectedSound)

  const [txtFilters, setTxtFilters] = useState<string[]>([])
  const [ratingFilter, setRatingFilter] = useState(0)
  const [ratingFilterSwitch, { toggle: toggleRatingFilter }] = useDisclosure(false)

  const filteredSounds = Sounds.filter(value => txtFilters.every(filter => value.id.includes(filter))).filter((value) => {
    const rate = soundRatings[value.id] ?? 0
    let result = false
    // (ratingFilterSwitch && ratingFilter ? true : true && )
    if (ratingFilterSwitch) {
      if (rate === ratingFilter) result = true
    }
    else {
      result = true
    }
    return result
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  const CorrectedRatingFilter = ratingFilterSwitch ? ratingFilter : 0
  useEffect(() => scrollRef.current?.scrollTo({ top: 0 }), [txtFilters, CorrectedRatingFilter, ratingFilterSwitch, targetVersion])

  const itemHeight = 40

  useWindowSize()

  const containerHeight = scrollRef.current?.getBoundingClientRect().height || 0

  const { displayingItems, handleScroll, startIndex } = useVirtualScroll({
    containerHeight,
    itemHeight,
    items: filteredSounds,
  })

  const listBoxHeightCSS = 'calc(100vh - 391px)'

  const onChangeSearchWord = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setTxtFilters(e.target.value.split(' ')), [setTxtFilters])

  const onSelectSound = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    dispatch(updateSelectedSound({ id: e.currentTarget.id }))
  }, [dispatch])

  const onChangeRating = (id: string, rating: number) => {
    dispatch(updateSoundRating({ soundRatings: { ...soundRatings, [id]: rating } }))
  }
  const items = displayingItems.map(item => (
    <li
      key={item.id}
      style={{ height: itemHeight, display: 'flex', justifyContent: 'left', alignItems: 'center' }}
    >
      {item.id}
      <RatingStars rating={soundRatings[item.id] ?? 0} onChange={rate => onChangeRating(item.id, rate)} />
      {/*
      <Container
        onClick={onSelectSound}
        id={item.id}
        w="full"
        mah={itemHeight}
        style={{ transition: '0.25s all' }}
        _hover={{ background: ['blackAlpha.200', 'whiteAlpha.200'] }}
        bg=""
      >
        <Flex
          w="full"
          style={{ userSelect: 'none', transition: '0.25s all' }}
          backgroundColor={item.id == selectedSound ? ['blackAlpha.400', 'whiteAlpha.400'] : 'none'}
          paddingX={5}
          paddingY={2}
        >
          {item.id}
          <Space />
          <Box alignContent="center">
            <RatingStars rating={soundRatings[item.id] ?? 0} onChange={rate => onChangeRating(item.id, rate)} />
          </Box>
        </Flex>
      </Container> */}
    </li>
  ))

  return (
    <>
      <Flex>
        <Input onChange={onChangeSearchWord} placeholder={t('search_sound_id')} leftSection={<LuSearch size={16} />} />

        <Space />

        <Flex px={5} bg="">
          <Container>
            <RatingStars rating={ratingFilter} onChange={rate => setRatingFilter(rate)} />
          </Container>
        </Flex>
        {/* <Tooltip label="お気に入りフィルター" placement="bottom" animation="top"> */}
        <ActionIcon variant={ratingFilterSwitch ? 'filled' : 'outline'} color="blue" onClick={toggleRatingFilter}>
          {ratingFilterSwitch ? <LuFilter /> : <LuFilterX />}
        </ActionIcon>
        {/* </Tooltip> */}
      </Flex>

      <Group mt={7} style={{ border: '1px solid', borderColor: 'gray', borderRadius: 5 }} h={listBoxHeightCSS}>
        <div
          onScroll={handleScroll}
          ref={scrollRef}
          style={{ width: '100%', height: listBoxHeightCSS, overflowY: 'scroll' }}
        >
          <div style={{ height: filteredSounds.length * itemHeight }}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', position: 'relative', top: startIndex * itemHeight }}>
              {items}
            </ul>
          </div>
        </div>
      </Group>
    </>
  )
}
