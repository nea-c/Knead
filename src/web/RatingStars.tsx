import { GoStarFill } from 'react-icons/go'
import { Flex, useComputedColorScheme } from '@mantine/core'
import React, { JSX, useCallback } from 'react'

type RatingStarsProps = {
  rating: number
  onChange: (newRating: number) => void
  disabled?: boolean
}

export const RatingStars = ({ rating, onChange, disabled }: RatingStarsProps): JSX.Element => {
  const onClick1 = useCallback(() => rating !== 1 ? onChange(1) : onChange(0), [rating, onChange])
  const onClick2 = useCallback(() => rating !== 2 ? onChange(2) : onChange(0), [rating, onChange])
  const onClick3 = useCallback(() => rating !== 3 ? onChange(3) : onChange(0), [rating, onChange])
  const onClick4 = useCallback(() => rating !== 4 ? onChange(4) : onChange(0), [rating, onChange])
  const onClick5 = useCallback(() => rating !== 5 ? onChange(5) : onChange(0), [rating, onChange])

  const themeOf = useComputedColorScheme('light', { getInitialValueInEffect: true })

  const activeStarColorDisabled = themeOf === 'light' ? '#fde8c4' : '#4e3303'
  const inactiveStarColorDisabled = themeOf === 'light' ? '#ececec' : '#222222'
  const activeStarColorEnabled = themeOf === 'light' ? '#f59f0a' : '#f7b23b'
  const inactiveStarColorEnabled = themeOf === 'light' ? '#d3d3d3' : '#3a3a3a'

  if (disabled) {
    return (
      <Flex px={1} mt={7} component="button" style={{ backgroundColor: 'transparent', border: 'none' }} onClick={e => e.stopPropagation()}>
        <div><GoStarFill size={18} fill={rating >= 1 ? activeStarColorDisabled : inactiveStarColorDisabled} /></div>
        <div><GoStarFill size={18} fill={rating >= 2 ? activeStarColorDisabled : inactiveStarColorDisabled} /></div>
        <div><GoStarFill size={18} fill={rating >= 3 ? activeStarColorDisabled : inactiveStarColorDisabled} /></div>
        <div><GoStarFill size={18} fill={rating >= 4 ? activeStarColorDisabled : inactiveStarColorDisabled} /></div>
        <div><GoStarFill size={18} fill={rating >= 5 ? activeStarColorDisabled : inactiveStarColorDisabled} /></div>
      </Flex>
    )
  }

  return (
    <Flex px={1} mt={7} component="button" style={{ backgroundColor: 'transparent', border: 'none' }} onClick={e => e.stopPropagation()}>
      <div onClick={onClick1}><GoStarFill size={18} fill={rating >= 1 ? activeStarColorEnabled : inactiveStarColorEnabled} /></div>
      <div onClick={onClick2}><GoStarFill size={18} fill={rating >= 2 ? activeStarColorEnabled : inactiveStarColorEnabled} /></div>
      <div onClick={onClick3}><GoStarFill size={18} fill={rating >= 3 ? activeStarColorEnabled : inactiveStarColorEnabled} /></div>
      <div onClick={onClick4}><GoStarFill size={18} fill={rating >= 4 ? activeStarColorEnabled : inactiveStarColorEnabled} /></div>
      <div onClick={onClick5}><GoStarFill size={18} fill={rating >= 5 ? activeStarColorEnabled : inactiveStarColorEnabled} /></div>
    </Flex>
  )
}
