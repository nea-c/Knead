import type { BoxProps } from '@yamada-ui/react'

export const VIRTUAL_SELECT_ITEM_HEIGHT = 36
export const VIRTUAL_SELECT_DISABLED_OPACITY = 0.4

export const virtualSelectTriggerProps = {
  bg: 'inherit',
  border: '1px solid',
  borderColor: 'inherit',
  fontSize: 'md',
  fontWeight: 'normal',
  minH: '10',
  paddingTop: '2px',
  px: '3',
  rounded: 'md',
  transitionDuration: 'normal',
  transitionProperty: 'border-color, box-shadow, background-color, opacity',
  _hover: { borderColor: ['blackAlpha.500', 'whiteAlpha.400'] },
  _focusVisible: {
    borderColor: 'focus',
    boxShadow: '0 0 0 1px var(--ui-colors-focus)',
  },
  _disabled: { cursor: 'not-allowed', opacity: VIRTUAL_SELECT_DISABLED_OPACITY },
} satisfies BoxProps

export const virtualSelectMenuProps = {
  bg: ['white', 'black'],
  border: '1px solid',
  borderColor: ['blackAlpha.200', 'whiteAlpha.100'],
  boxShadow: ['lg', 'dark-lg'],
  overflow: 'hidden',
  rounded: 'md',
} satisfies BoxProps

export const virtualSelectPopupMotionProps = {
  duration: 0.2,
  scale: 1,
  transformOrigin: 'top center',
} as const

export const virtualSelectClearButtonProps = {
  alignItems: 'center',
  bg: 'transparent',
  color: ['blackAlpha.600', 'whiteAlpha.700'],
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'center',
  minH: '7',
  minW: '7',
  p: '1',
  rounded: 'sm',
  _hover: { bg: ['blackAlpha.100', 'whiteAlpha.100'] },
  _focusVisible: { boxShadow: '0 0 0 2px var(--ui-colors-focus)' },
} satisfies BoxProps

export const virtualSelectEmptyProps = {
  alignItems: 'center',
  color: 'muted',
  display: 'flex',
  fontSize: 'sm',
  minH: VIRTUAL_SELECT_ITEM_HEIGHT,
  px: '3',
  py: '2',
} satisfies BoxProps

export const virtualSelectItemProps = {
  cursor: 'pointer',
  px: '3',
  py: '1.5',
  transitionDuration: 'ultra-fast',
  transitionProperty: 'background',
  transitionTimingFunction: 'ease-in',
  userSelect: 'none',
} satisfies BoxProps

export const virtualSelectActiveItemProps = {
  bg: ['blackAlpha.100', 'whiteAlpha.100'],
} satisfies BoxProps

export const virtualSelectSelectedItemProps = {
  bg: ['blackAlpha.100', 'whiteAlpha.100'],
} satisfies BoxProps

export const virtualSelectHeadingProps = {
  color: 'muted',
  fontSize: 'sm',
  fontWeight: 'semibold',
  px: '3',
} satisfies BoxProps

export function isVirtualSelectPopupVisible(open: boolean, itemCount: number): boolean {
  return open && itemCount > 0
}

export function getVirtualSelectItemState(
  selected: boolean,
  active: boolean,
): 'selected' | 'active' | 'idle' {
  if (selected) return 'selected'
  if (active) return 'active'
  return 'idle'
}
