import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAddDispatch, useAppSelector } from '../../store/_store'
import { Box, Flex, IconButton, Input, InputGroup, InputLeftElement, InputRightElement, Menu, MenuButton, MenuGroup, MenuItem, MenuList, MenuOptionGroup, MenuOptionItem, MenuSeparator, Spacer, Toggle, useColorModeValue } from '@yamada-ui/react'
import { ArrowDownAZIcon, FilterIcon, SearchIcon, SquareCheckBigIcon, XIcon } from '@yamada-ui/lucide'
import { useVirtualScroll } from '../../hooks/useVirtualScroll'
import { RatingStars } from './RatingStars'
import { updateSelectedSound } from '../../store/fetchSlice'
import { useWindowSize } from '../../hooks/useWindowSize'
import { useTranslation } from 'react-i18next'
import { GoStarFill } from 'react-icons/go'
import { SoundSort } from '../../config'

declare interface Window {
  myAPI: {
    setSelectedSound: (id: string) => void
  }
}

export const SoundSelector = () => {
  const dispatch = useAddDispatch()
  const { t } = useTranslation()

  const Sounds = useAppSelector(state => state.fetch.sounds)
  const [soundRatings, setSoundRatings] = useState<({ [key: string]: number })>({})
  useEffect(() => {
    (async () => {
      const ratingStar = await window.myAPI.loadRatingStar()
      setSoundRatings(ratingStar)
    })()
  }, [])

  const targetVersion = useAppSelector(state => state.fetch.targetVersion ?? '')
  const selectedSound = useAppSelector(state => state.fetch.selectedSound)

  const [searchTxt, setSearchTxt] = useState<string>('')
  const [txtFilters, setTxtFilters] = useState<string[]>([])

  const [SoundsSort, setSoundsSort] = useState<{ id: string, rating: string }>({ id: 'ascending', rating: 'none' })
  useEffect(() => {
    (async () => {
      const holdSoundsSort = await window.myAPI.getSetting('holdSoundsSort') as boolean
      const sort_data = await window.myAPI.getSetting('lastSoundsSort') as SoundSort
      if (holdSoundsSort == true) setSoundsSort(sort_data)
      else window.myAPI.updateSettings({ lastSoundsSort: { id: 'ascending', rating: 'none' } })
    })()
  }, [])

  const changeSoundSorts = ({ id, rating }: { id?: string, rating?: string }) => {
    if (!SoundsSort) return
    const newSort = (() => {
      if (id && rating) return { id, rating }
      else if (id) return { ...SoundsSort, id }
      else if (rating) return { ...SoundsSort, rating }
      return SoundsSort
    })()
    setSoundsSort(newSort)
    window.myAPI.updateSettings({ lastSoundsSort: newSort })
  }

  const [ratingFilter, setRatingFilter] = useState<number[]>([])
  useEffect(() => {
    (async () => {
      const holdRatingFilter = await window.myAPI.getSetting('holdRatingFilter') as boolean
      const filter_data = await window.myAPI.getSetting('lastRatingFilter') as number[]
      if (holdRatingFilter == true) setRatingFilter(filter_data)
      else window.myAPI.updateSettings({ lastRatingFilter: [] })
    })()
  }, [])

  const clearRatingFilters = () => {
    setRatingFilter([])
    window.myAPI.updateSettings({ lastRatingFilter: [] })
  }
  const allOnRatingFilters = () => {
    setRatingFilter([0, 1, 2, 3, 4, 5])
    window.myAPI.updateSettings({ lastRatingFilter: [0, 1, 2, 3, 4, 5] })
  }
  const changeRatingFilters = (v: string[]) => {
    setRatingFilter(v.map(v => parseInt(v)))
    window.myAPI.updateSettings({ lastRatingFilter: v.map(v => parseInt(v)) })
  }

  const filteredSounds = (() => {
    const filtered = Sounds.filter(value => txtFilters.every(filter => value.id.includes(filter))).filter((value) => {
      const rate = soundRatings[value.id] ?? 0
      let result = false
      if (ratingFilter && ratingFilter.some(v => v >= 0 ? true : false)) {
        if (ratingFilter.some(v => v === rate)) result = true
      }
      else {
        result = true
      }
      return result
    })
    if (!SoundsSort) return filtered
    const id_sorted = SoundsSort.id == 'ascending' ? filtered : filtered.reverse()
    return (() => {
      if (SoundsSort.rating == 'none') return id_sorted

      if (SoundsSort.rating == 'ascending') return id_sorted.sort((a, b) => (soundRatings[a.id] ?? 0) - (soundRatings[b.id] ?? 0))
      else return id_sorted.sort((a, b) => (soundRatings[b.id] ?? 0) - (soundRatings[a.id] ?? 0))
    })()
  })()

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => scrollRef.current?.scrollTo({ top: 0 }), [txtFilters, ratingFilter, targetVersion])

  const itemHeight = 40

  useWindowSize()

  const listBoxHeightCSS = 'calc(100vh - 388.5px)'
  const initialHeight = window.innerHeight - 388.5

  const containerHeight = scrollRef.current?.getBoundingClientRect().height || initialHeight

  const { displayingItems, handleScroll, startIndex } = useVirtualScroll({
    containerHeight,
    itemHeight,
    items: filteredSounds,
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [containerHeight])

  const onChangeSearchWord = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTxt(e.target.value)
    setTxtFilters(e.target.value.split(' '))
  }, [setTxtFilters])

  const [isSelecting, setIsSelecting] = useState(false)

  const onSelectSound = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isSelecting) return
    setIsSelecting(true)
    dispatch(updateSelectedSound({ id: e.currentTarget.id }))
    window.myAPI.setSelectedSound(e.currentTarget.id)
    setTimeout(() => {
      setIsSelecting(false)
    }, 250)
  }, [dispatch, isSelecting])

  const onChangeRating = (id: string, rating: number) => {
    const CorrectSoundRatings = { ...soundRatings, [id]: rating }
    // 値が0のプロパティを削除
    Object.keys(soundRatings).map((v) => {
      if (CorrectSoundRatings[v] === 0 && v != '_') delete CorrectSoundRatings[v]
    })
    setSoundRatings(CorrectSoundRatings)
    window.myAPI.saveRatingStarAsString(JSON.stringify(CorrectSoundRatings))
  }

  const activeStarColor = useColorModeValue('var(--ui-colors-amber-500)', 'var(--ui-colors-amber-400)')
  const inactiveStarColor = useColorModeValue('var(--ui-colors-blackAlpha-300)', 'var(--ui-colors-whiteAlpha-300)')

  const labelRatingStar = (size: number, rating: number, marginBottom: number, paddingY?: number) => {
    return (
      <Box marginBottom={marginBottom} paddingY={paddingY ? paddingY : 0}>
        <GoStarFill size={size} fill={rating >= 1 ? activeStarColor : inactiveStarColor} />
        <GoStarFill size={size} fill={rating >= 2 ? activeStarColor : inactiveStarColor} />
        <GoStarFill size={size} fill={rating >= 3 ? activeStarColor : inactiveStarColor} />
        <GoStarFill size={size} fill={rating >= 4 ? activeStarColor : inactiveStarColor} />
        <GoStarFill size={size} fill={rating >= 5 ? activeStarColor : inactiveStarColor} />
      </Box>
    )
  }

  const items = displayingItems.map(item => (
    <li
      key={item.id}
      className="sound-list-li"
    >
      <Box
        onClick={onSelectSound}
        id={item.id}
        w="full"
        maxH={itemHeight}
        className="sound-list-box"
        _hover={{ background: ['blackAlpha.200', 'whiteAlpha.200'] }}
        bg=""
      >
        <Flex
          w="full"
          className={`sound-list-flex${item.id == selectedSound ? ' selected' : ''}`}
          paddingX={5}
          paddingY={2}
        >
          {item.id}
          <Spacer />
          <Box alignContent="center">
            <RatingStars rating={soundRatings[item.id] ?? 0} onChange={rate => onChangeRating(item.id, rate)} />
          </Box>
        </Flex>
      </Box>
    </li>
  ))

  return (
    <>
      <Flex w="full">
        <InputGroup>
          <InputLeftElement>
            <SearchIcon color="gray.500" fontSize="lg" />
          </InputLeftElement>

          <Input value={searchTxt} onChange={onChangeSearchWord} placeholder={t('search_sound_id')} />
          <InputRightElement
            clickable
            onClick={() => {
              setTxtFilters([])
              setSearchTxt('')
            }}
          >
            <XIcon color="gray.500" fontSize="lg" />
          </InputRightElement>
        </InputGroup>

        <Spacer minW={2} />

        <Menu animation="top" gutter={0}>
          <MenuButton as={IconButton} icon={<ArrowDownAZIcon fontSize="xl" />} variant="outline" borderColor="inherit" />

          <MenuList className="menu-list-no-style">
            <MenuOptionGroup label={t('id_sort')} type="radio" value={SoundsSort?.id} onChange={value => changeSoundSorts({ id: value })}>
              <MenuOptionItem value="ascending">{t('ascending')}</MenuOptionItem>
              <MenuOptionItem value="descending">{t('descending')}</MenuOptionItem>
            </MenuOptionGroup>
            <MenuSeparator />
            <MenuOptionGroup label={t('rating_sort')} type="radio" value={SoundsSort?.rating} onChange={value => changeSoundSorts({ rating: value })}>
              <MenuOptionItem value="none">{t('none')}</MenuOptionItem>
              <MenuOptionItem value="ascending">{t('ascending')}</MenuOptionItem>
              <MenuOptionItem value="descending">{t('descending')}</MenuOptionItem>
            </MenuOptionGroup>
          </MenuList>
        </Menu>
        <Spacer minW={2} />

        <Menu animation="top" gutter={0} closeOnSelect={false}>
          <MenuButton
            as={Toggle}
            selected={ratingFilter?.some(v => v >= 0 ? true : false)}
            icon={<FilterIcon fontSize="xl" />}
            variant="outline"
            colorScheme="primary"
          />

          <MenuList className="menu-list-no-style">
            <MenuGroup label={t('rating_filter')}>
              <MenuItem onClick={() => clearRatingFilters()} icon={<XIcon fontSize="lg" />}>{t('clear_filter')}</MenuItem>
              <MenuItem onClick={() => allOnRatingFilters()} icon={<SquareCheckBigIcon fontSize="lg" />}>{t('all_on_filter')}</MenuItem>
              <MenuSeparator />

              <MenuOptionGroup
                type="checkbox"
                value={ratingFilter?.map(v => v.toString())}
                onChange={(v: string[]) => changeRatingFilters(v)}
              >
                <MenuOptionItem value="5">{labelRatingStar(18, 5, -2, 1)}</MenuOptionItem>
                <MenuOptionItem value="4">{labelRatingStar(18, 4, -2, 1)}</MenuOptionItem>
                <MenuOptionItem value="3">{labelRatingStar(18, 3, -2, 1)}</MenuOptionItem>
                <MenuOptionItem value="2">{labelRatingStar(18, 2, -2, 1)}</MenuOptionItem>
                <MenuOptionItem value="1">{labelRatingStar(18, 1, -2, 1)}</MenuOptionItem>
                <MenuOptionItem value="0">{labelRatingStar(18, 0, -2, 1)}</MenuOptionItem>
              </MenuOptionGroup>
            </MenuGroup>
          </MenuList>
        </Menu>
      </Flex>

      <Box marginTop={2} border="1px solid" borderColor="inherit" borderRadius={5} h={listBoxHeightCSS}>
        <div
          onScroll={handleScroll}
          ref={scrollRef}
          className="sound-list-container"
        >
          <div className="sound-list-outer" style={{ height: (filteredSounds.length * itemHeight) + 2 }}>
            <ul className="sound-list-ul" style={{ top: startIndex * itemHeight }}>
              {items}
            </ul>
          </div>
        </div>
      </Box>
    </>
  )
}
