import React, { FC, useState, useRef, useEffect, useMemo, ChangeEvent, useId } from 'react'
import { Box, Input } from '@yamada-ui/react'
import { ChevronDownIcon } from '@yamada-ui/lucide'
import { FixedSizeList as VirtualList, ListChildComponentProps } from 'react-window'
import {
  VIRTUAL_SELECT_ITEM_HEIGHT,
  VIRTUAL_SELECT_DISABLED_OPACITY,
  getVirtualSelectItemState,
  isVirtualSelectPopupVisible,
  virtualSelectActiveItemProps,
  virtualSelectItemProps,
  virtualSelectMenuProps,
  virtualSelectSelectedItemProps,
  virtualSelectTriggerProps,
} from '../../components/virtualSelectStyles'
import { matchesVirtualSelectQuery } from '../../components/virtualSelectSearch'

interface Props {
  options: string[]
  value: string
  placeholder?: string
  onSelect: (val: string) => void
  height?: number
  isDisabled?: boolean
  focusRequest?: number
  onFocusRequestHandled?: () => void
}

export const AudioSelectDropdown: FC<Props> = ({
  options,
  value,
  placeholder = '',
  onSelect,
  height = 300,
  isDisabled = false,
  focusRequest = 0,
  onFocusRequestHandled,
}) => {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<VirtualList>(null)
  const handledFocusRequest = useRef(0)
  const listboxId = useId()

  useEffect(() => {
    if (isDisabled || focusRequest <= 0 || handledFocusRequest.current === focusRequest) return
    handledFocusRequest.current = focusRequest
    setInputValue(value)
    setActiveIndex(0)
    setOpen(true)
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
      onFocusRequestHandled?.()
    })
    return () => cancelAnimationFrame(frame)
  }, [focusRequest, isDisabled, value, onFocusRequestHandled])

  const openDropdown = () => {
    setInputValue(value)
    setActiveIndex(Math.max(0, options.indexOf(value)))
    setOpen(true)
    requestAnimationFrame(() => {
      inputRef.current?.select()
    })
  }

  // 外部クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  // 入力値でフィルタ (空白区切り AND 検索)
  const filteredOptions = useMemo(() => {
    return options.filter(option => matchesVirtualSelectQuery(option, inputValue))
  }, [options, inputValue])
  const popupVisible = isVirtualSelectPopupVisible(open, filteredOptions.length)

  useEffect(() => {
    if (!open || filteredOptions.length === 0) return
    const nextIndex = Math.min(activeIndex, filteredOptions.length - 1)
    if (nextIndex !== activeIndex) setActiveIndex(nextIndex)
    listRef.current?.scrollToItem(nextIndex, 'smart')
  }, [activeIndex, filteredOptions.length, open])

  const selectOption = (opt: string) => {
    onSelect(opt)
    setInputValue('')
    setOpen(false)
  }

  const Row: FC<ListChildComponentProps> = ({ index, style }) => {
    const opt = filteredOptions[index]
    const selected = opt === value
    const active = index === activeIndex
    const state = getVirtualSelectItemState(selected, active)
    const background = state === 'selected'
      ? virtualSelectSelectedItemProps.bg
      : state === 'active'
        ? virtualSelectActiveItemProps.bg
        : 'transparent'
    return (
      <Box
        {...virtualSelectItemProps}
        aria-selected={selected}
        bg={background}
        id={`${listboxId}-option-${index}`}
        onClick={() => selectOption(opt)}
        onMouseEnter={() => setActiveIndex(index)}
        overflow="hidden"
        role="option"
        style={style}
        textOverflow="ellipsis"
        title={opt}
        whiteSpace="nowrap"
      >
        {opt}
      </Box>
    )
  }

  return (
    <Box ref={ref} position="relative" width="100%">
      <Input
        {...virtualSelectTriggerProps}
        ref={inputRef}
        aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={popupVisible}
        aria-haspopup="listbox"
        cursor={isDisabled ? 'not-allowed' : 'pointer'}
        pe="8"
        role="combobox"
        value={open ? inputValue : value}
        placeholder={placeholder}
        readOnly={isDisabled}
        onClick={() => {
          if (isDisabled) return
          if (open) setOpen(false)
          else openDropdown()
        }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          setInputValue(e.target.value)
          setActiveIndex(0)
          if (!open) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) {
              setOpen(true)
              setActiveIndex(0)
              return
            }
            const direction = e.key === 'ArrowDown' ? 1 : -1
            setActiveIndex(current => Math.max(0, Math.min(filteredOptions.length - 1, current + direction)))
          }
          else if (e.key === 'Enter' && open && filteredOptions[activeIndex]) {
            e.preventDefault()
            selectOption(filteredOptions[activeIndex])
          }
          else if (e.key === 'Escape' && open) {
            e.preventDefault()
            setOpen(false)
          }
        }}
        disabled={isDisabled}
      />
      <Box
        aria-hidden
        color={['blackAlpha.600', 'whiteAlpha.700']}
        data-virtual-select-chevron="true"
        opacity={isDisabled ? VIRTUAL_SELECT_DISABLED_OPACITY : 1}
        pointerEvents="none"
        position="absolute"
        right="2"
        top="50%"
        transform="translateY(-50%)"
      >
        <ChevronDownIcon transform={popupVisible ? 'rotate(180deg)' : undefined} transition="transform 0.15s" />
      </Box>
      {popupVisible && (
        <Box
          {...virtualSelectMenuProps}
          id={listboxId}
          position="absolute"
          role="listbox"
          top="calc(100% + 4px)"
          width="100%"
          zIndex={10}
        >
          <VirtualList
            ref={listRef}
            height={Math.min(filteredOptions.length * VIRTUAL_SELECT_ITEM_HEIGHT, height)}
            width="100%"
            itemCount={filteredOptions.length}
            itemSize={VIRTUAL_SELECT_ITEM_HEIGHT}
          >
            {Row}
          </VirtualList>
        </Box>
      )}
    </Box>
  )
}
