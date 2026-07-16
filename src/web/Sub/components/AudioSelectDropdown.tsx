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
}

export const AudioSelectDropdown: FC<Props> = ({
  options,
  value,
  placeholder = '',
  onSelect,
  height = 300,
  isDisabled = false,
}) => {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const openDropdown = () => {
    setInputValue(value)
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

  const Row: FC<ListChildComponentProps> = ({ index, style }) => {
    const opt = filteredOptions[index]
    const selected = opt === value
    return (
      <div
        style={{
          ...style,
          background: selected ? '#2563eb' : 'transparent',
          color: selected ? '#fff' : 'inherit',
          padding: '6px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={opt}
        onClick={() => {
          onSelect(opt)
          setInputValue('')
          setOpen(false)
        }}
        onMouseOver={e => (e.currentTarget.style.background = '#374151')}
        onMouseOut={e => (e.currentTarget.style.background = selected ? '#2563eb' : 'transparent')}
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
          if (!open) setOpen(true)
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
