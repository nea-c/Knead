import type { BoxProps } from '@yamada-ui/react'

export const VIRTUAL_SELECT_ITEM_HEIGHT = 36

export const virtualSelectTriggerProps = {
  bg: 'inherit',
  border: '1px solid',
  borderColor: 'inherit',
  fontSize: 'md',
  fontWeight: 'normal',
  minH: '10',
  px: '3',
  rounded: 'md',
  transitionDuration: 'normal',
  transitionProperty: 'border-color, box-shadow, background-color, opacity',
  _hover: { borderColor: ['blackAlpha.500', 'whiteAlpha.400'] },
  _focusVisible: {
    borderColor: 'focus',
    boxShadow: '0 0 0 1px var(--ui-colors-focus)',
  },
  _disabled: { cursor: 'not-allowed', opacity: 0.4 },
} satisfies BoxProps

export const virtualSelectMenuProps = {
  bg: ['white', 'black'],
  border: '1px solid',
  borderColor: ['blackAlpha.200', 'whiteAlpha.100'],
  boxShadow: ['lg', 'dark-lg'],
  overflow: 'hidden',
  rounded: 'md',
} satisfies BoxProps

export const virtualSelectItemProps = {
  cursor: 'pointer',
  px: '3',
  transitionDuration: 'ultra-fast',
  transitionProperty: 'background',
  transitionTimingFunction: 'ease-in',
  userSelect: 'none',
} satisfies BoxProps

export const virtualSelectActiveItemProps = {
  bg: ['blackAlpha.100', 'whiteAlpha.100'],
} satisfies BoxProps

export const virtualSelectSelectedItemProps = {
  bg: ['blackAlpha.200', 'whiteAlpha.200'],
} satisfies BoxProps

export const virtualSelectHeadingProps = {
  color: 'muted',
  fontSize: 'sm',
  fontWeight: 'semibold',
  px: '3',
} satisfies BoxProps

export function getVirtualSelectItemState(
  selected: boolean,
  active: boolean,
): 'selected' | 'active' | 'idle' {
  if (selected) return 'selected'
  if (active) return 'active'
  return 'idle'
}
