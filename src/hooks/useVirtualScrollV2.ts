import { useCallback, useEffect, useRef, useState, useMemo } from 'react'

export interface VirtualScrollItem {
  index: number
  top: number
  height: number
}

interface UseVirtualScrollV2Options {
  itemCount: number
  _getItemKey: (index: number) => string | number
  _getItemHeight: (index: number) => number
  containerHeight: number
  overscan?: number
  initialScrollTop?: number
}

export function useVirtualScrollV2({
  itemCount,
  _getItemKey,
  _getItemHeight,
  containerHeight,
  overscan = 3,
  initialScrollTop = 0,
}: UseVirtualScrollV2Options) {
  const [scrollTop, setScrollTop] = useState(initialScrollTop)
  const [itemHeights, setItemHeights] = useState<number[]>(Array(itemCount).fill(0))
  const containerRef = useRef<HTMLDivElement>(null)

  // 各アイテムの高さを記録
  const setItemHeight = useCallback((index: number, height: number) => {
    setItemHeights((prev) => {
      if (prev[index] === height) return prev
      const next = [...prev]
      next[index] = height
      return next
    })
  }, [])

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // ループの中でHooksを呼んだと誤検知されないように、全計算をuseMemoにまとめる
  const { positions, totalHeight, visibleItems } = useMemo(() => {
    const pos: VirtualScrollItem[] = []
    let acc = 0

    for (let i = 0; i < itemCount; i++) {
      const h = itemHeights[i] || 40
      pos.push({ index: i, top: acc, height: h })
      acc += h
    }
    const tot = acc

    const startIdx = Math.max(
      0,
      pos.findIndex(p => p.top + p.height > scrollTop) - overscan,
    )
    const endIdx = Math.min(
      itemCount,
      pos.findIndex(p => p.top > scrollTop + containerHeight) + overscan,
    )
    const visible = pos.slice(startIdx, endIdx > startIdx ? endIdx : undefined)

    return {
      positions: pos,
      totalHeight: tot,
      visibleItems: visible,
    }
  }, [
    itemCount,
    itemHeights,
    scrollTop,
    containerHeight,
    overscan,
  ])

  // スクロール位置復元
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = scrollTop
    }
  }, [scrollTop])

  // リストが変わったら高さ配列をリセット
  useEffect(() => {
    setItemHeights(Array(itemCount).fill(0))
  }, [itemCount])

  return {
    containerRef,
    onScroll,
    visibleItems,
    setItemHeight,
    totalHeight,
    scrollTop,
    setScrollTop,
  }
}
