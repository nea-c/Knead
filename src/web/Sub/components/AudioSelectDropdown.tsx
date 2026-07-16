import React, { FC, useState, useRef, useEffect, useMemo, ChangeEvent } from 'react'
import { Box, Input } from '@yamada-ui/react'
import { FixedSizeList as VirtualList, ListChildComponentProps } from 'react-window'

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
    const tokens = inputValue.toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return options
    return options.filter((opt) => {
      const lower = opt.toLowerCase()
      return tokens.every(t => lower.includes(t))
    })
  }, [options, inputValue])

  const ITEM_H = 30

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
    return (
      <div
        style={{
          ...style,
          background: active ? '#374151' : (selected ? '#2563eb' : 'transparent'),
          color: selected || active ? '#fff' : 'inherit',
          padding: '6px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={opt}
        onClick={() => selectOption(opt)}
        onMouseEnter={() => setActiveIndex(index)}
      >
        {opt}
      </div>
    )
  }

  return (
    <Box position="relative" width="100%">
      <Input
        ref={inputRef}
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
        cursor="pointer"
        disabled={isDisabled}
      />
      {open && (
        <Box
          ref={ref}
          position="absolute"
          top="100%"
          width="100%"
          bg="gray.800"
          border="1px solid"
          borderColor="gray.600"
          borderRadius="md"
          zIndex={10}
        >
          <VirtualList
            ref={listRef}
            height={Math.min(filteredOptions.length * ITEM_H, height)}
            width="100%"
            itemCount={filteredOptions.length}
            itemSize={ITEM_H}
          >
            {Row}
          </VirtualList>
        </Box>
      )}
    </Box>
  )
}
