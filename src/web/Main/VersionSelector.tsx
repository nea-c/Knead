import React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, HStack, Input, Text } from '@yamada-ui/react'
import { useAddDispatch } from '../../store/_store'
import { Sound, updateSoundList, updateTargetVersion } from '../../store/fetchSlice'
import { VersionInfoType, compareReleaseVersionInfo, compareSnapshotVersionInfo, comparePreReleaseVersionInfo, compareReleaseCandidateVersionInfo, parseVersion } from '../../types/VersionInfo'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
import { ChevronDownIcon, CircleCheckIcon, DownloadIcon } from '@yamada-ui/lucide'
import { FixedSizeList as VirtualList, ListChildComponentProps } from 'react-window'
import {
  VIRTUAL_SELECT_ITEM_HEIGHT,
  VIRTUAL_SELECT_DISABLED_OPACITY,
  getVirtualSelectItemState,
  isVirtualSelectPopupVisible,
  virtualSelectActiveItemProps,
  virtualSelectHeadingProps,
  virtualSelectItemProps,
  virtualSelectMenuProps,
  virtualSelectSelectedItemProps,
  virtualSelectTriggerProps,
} from '../components/virtualSelectStyles'
import { filterVersionRows, VersionFilterRow } from '../components/virtualSelectSearch'

type AssetDownloadProgress = {
  version: string
  completedAssets: number
  totalAssets: number
}

type AvailableVersion = VersionInfoType & {
  downloaded: boolean
}

type VersionRow = VersionFilterRow<AvailableVersion>

type VersionRowData = {
  activeIndex: number
  rows: VersionRow[]
  selectedVersion: string
  onActivate: (index: number) => void
  onSelect: (version: string) => void
}

type VirtualVersionSelectProps = {
  disabled: boolean
  placeholder: string
  rows: VersionRow[]
  value: string
  onChange: (version: string) => void
}

const VERSION_LIST_HEIGHT = VIRTUAL_SELECT_ITEM_HEIGHT * 8

const VersionStatusIcon = ({ downloaded }: { downloaded: boolean }) => downloaded
  ? <CircleCheckIcon aria-hidden color="green.500" fontSize="md" />
  : <DownloadIcon aria-hidden color="gray.500" fontSize="md" />

const VirtualVersionRow = React.memo(({ index, style, data }: ListChildComponentProps<VersionRowData>) => {
  const row = data.rows[index]
  if (row.type === 'heading') {
    return (
      <Box {...virtualSelectHeadingProps} paddingY={2} role="presentation" style={style}>
        {row.label}
      </Box>
    )
  }

  const selected = row.version.raw === data.selectedVersion
  const active = index === data.activeIndex
  const state = getVirtualSelectItemState(selected, active)
  const background = state === 'selected'
    ? virtualSelectSelectedItemProps.bg
    : state === 'active'
      ? virtualSelectActiveItemProps.bg
      : 'transparent'
  return (
    <HStack
      {...virtualSelectItemProps}
      aria-selected={selected}
      bg={background}
      gap={2}
      id={`version-option-${index}`}
      onClick={() => data.onSelect(row.version.raw)}
      onMouseEnter={() => data.onActivate(index)}
      role="option"
      style={style}
      title={row.version.raw}
    >
      <VersionStatusIcon downloaded={row.version.downloaded} />
      <Text overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {row.version.raw}
      </Text>
    </HStack>
  )
})
VirtualVersionRow.displayName = 'VirtualVersionRow'

export const VirtualVersionSelect = ({ disabled, placeholder, rows, value, onChange }: VirtualVersionSelectProps) => {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<VirtualList>(null)
  const selectedVersion = useMemo(() => {
    const row = rows.find((row): row is Extract<VersionRow, { type: 'version' }> => {
      return row.type === 'version' && row.version.raw === value
    })
    return row?.version
  }, [rows, value])

  const filteredRows = useMemo(() => filterVersionRows(rows, inputValue), [inputValue, rows])
  const firstVersionIndex = useMemo(() => filteredRows.findIndex(row => row.type === 'version'), [filteredRows])
  const selectableVersionCount = useMemo(() => filteredRows.filter(row => row.type === 'version').length, [filteredRows])
  const popupVisible = isVirtualSelectPopupVisible(open, selectableVersionCount)

  const activate = useCallback((index: number) => {
    setActiveIndex(index)
    listRef.current?.scrollToItem(index, 'smart')
  }, [])

  const openList = useCallback(() => {
    const initialRows = filterVersionRows(rows, value)
    const initialVersionIndex = initialRows.findIndex(row => row.type === 'version')
    if (initialVersionIndex < 0) return
    const initialSelectedIndex = initialRows.findIndex((row) => {
      return row.type === 'version' && row.version.raw === value
    })
    setInputValue(value)
    const nextIndex = initialSelectedIndex >= 0 ? initialSelectedIndex : initialVersionIndex
    setActiveIndex(nextIndex)
    setOpen(true)
    requestAnimationFrame(() => {
      inputRef.current?.select()
      listRef.current?.scrollToItem(nextIndex, 'smart')
    })
  }, [rows, value])

  const selectVersion = useCallback((version: string) => {
    onChange(version)
    setOpen(false)
  }, [onChange])

  const moveActive = useCallback((direction: 1 | -1) => {
    let nextIndex = activeIndex
    do {
      nextIndex += direction
    } while (nextIndex >= 0 && nextIndex < filteredRows.length && filteredRows[nextIndex].type !== 'version')
    if (nextIndex < 0 || nextIndex >= filteredRows.length) return
    activate(nextIndex)
  }, [activate, activeIndex, filteredRows])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', closeOnOutsideClick)
    return () => window.removeEventListener('mousedown', closeOnOutsideClick)
  }, [open])

  useEffect(() => {
    if (disabled || !rows.some(row => row.type === 'version')) setOpen(false)
  }, [disabled, rows])

  useEffect(() => {
    if (!open || firstVersionIndex < 0) return
    if (filteredRows[activeIndex]?.type !== 'version') {
      activate(firstVersionIndex)
    }
  }, [activate, activeIndex, filteredRows, firstVersionIndex, open])

  const rowData = useMemo<VersionRowData>(() => ({
    activeIndex,
    rows: filteredRows,
    selectedVersion: value,
    onActivate: activate,
    onSelect: selectVersion,
  }), [activeIndex, activate, filteredRows, selectVersion, value])

  return (
    <Box ref={containerRef} position="relative" width="14rem" zIndex={popupVisible ? 100 : undefined}>
      <Input
        {...virtualSelectTriggerProps}
        ref={inputRef}
        aria-activedescendant={open && filteredRows[activeIndex]?.type === 'version' ? `version-option-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-controls="version-listbox"
        aria-expanded={popupVisible}
        aria-haspopup="listbox"
        cursor={disabled ? 'not-allowed' : 'pointer'}
        disabled={disabled}
        pe="8"
        ps={selectedVersion ? '8' : '3'}
        onClick={() => open ? setOpen(false) : openList()}
        onChange={(event) => {
          setInputValue(event.target.value)
          setActiveIndex(0)
          if (!open) setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              openList()
            }
            else {
              moveActive(event.key === 'ArrowDown' ? 1 : -1)
            }
          }
          else if (event.key === 'Enter' && open) {
            event.preventDefault()
            const row = filteredRows[activeIndex]
            if (row?.type === 'version') selectVersion(row.version.raw)
          }
          else if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
          }
        }}
        placeholder={placeholder}
        readOnly={disabled}
        role="combobox"
        value={open ? inputValue : value}
      />
      {selectedVersion && (
        <Box aria-hidden left="3" pointerEvents="none" position="absolute" top="50%" transform="translateY(-50%)">
          <VersionStatusIcon downloaded={selectedVersion.downloaded} />
        </Box>
      )}
      <Box
        aria-hidden
        color={['blackAlpha.600', 'whiteAlpha.700']}
        data-virtual-select-chevron="true"
        opacity={disabled ? VIRTUAL_SELECT_DISABLED_OPACITY : 1}
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
          id="version-listbox"
          left={0}
          overflow="hidden"
          position="absolute"
          role="listbox"
          top="calc(100% + 4px)"
          width="full"
          zIndex={50}
        >
          <VirtualList
            height={Math.min(filteredRows.length * VIRTUAL_SELECT_ITEM_HEIGHT, VERSION_LIST_HEIGHT)}
            itemCount={filteredRows.length}
            itemData={rowData}
            itemKey={(index, data) => {
              const row = data.rows[index]
              return row.type === 'heading' ? `heading-${row.label}` : row.version.raw
            }}
            itemSize={VIRTUAL_SELECT_ITEM_HEIGHT}
            overscanCount={3}
            ref={listRef}
            width="100%"
          >
            {VirtualVersionRow}
          </VirtualList>
        </Box>
      )}
    </Box>
  )
}

export const VersionSelector = () => {
  const { t } = useTranslation()
  const dispatch = useAddDispatch()

  const [versions, setVersions] = useState<AvailableVersion[]>([])
  const [SelectedVersion, setSelectedVersion] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<AssetDownloadProgress | null>(null)
  const loadedSoundsVersionRef = useRef('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const setting = await window.myAPI.getSetting('selectedVersion')
      const rawVersion = typeof setting === 'string'
        ? setting
        : typeof setting === 'object' && setting !== null && 'raw' in setting && typeof setting.raw === 'string'
          ? setting.raw
          : undefined
      const version = rawVersion ? parseVersion(rawVersion) : undefined
      if (cancelled || !version) return
      setSelectedVersion(version.raw)
      dispatch(updateTargetVersion({ targetVersion: version }))
    })()
    return () => {
      cancelled = true
    }
  }, [dispatch])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const availableVersions = await window.myAPI.get_versions()
        if (cancelled) return
        const parsedVersions = availableVersions.flatMap(({ id, downloaded }) => {
          const parsed = parseVersion(id)
          return parsed ? [{ ...parsed, downloaded } as AvailableVersion] : []
        })
        setVersions(parsedVersions)
      }
      catch (e: unknown) {
        alert(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedVersionDownloaded = useMemo(() => {
    return versions.find(version => version.raw === SelectedVersion)?.downloaded
  }, [SelectedVersion, versions])

  useEffect(() => {
    if (!SelectedVersion || selectedVersionDownloaded === undefined) return
    if (loadedSoundsVersionRef.current === SelectedVersion) return
    let cancelled = false
    void (async () => {
      const shouldDownload = !selectedVersionDownloaded
      let stopListening: (() => void) | undefined
      try {
        if (shouldDownload) {
          setIsDownloading(true)
          setDownloadProgress(null)
          stopListening = await listen<AssetDownloadProgress>('asset-download-progress', (event) => {
            if (!cancelled && event.payload.version === SelectedVersion) {
              setDownloadProgress(event.payload)
            }
          })
          await window.myAPI.downloadVersionAssets(SelectedVersion)
        }
        const sounds: Sound[] = await window.myAPI.get_mcSounds(SelectedVersion)
        if (!cancelled) {
          loadedSoundsVersionRef.current = SelectedVersion
          if (shouldDownload) {
            setVersions(versions => versions.map((version) => {
              return version.raw === SelectedVersion ? { ...version, downloaded: true } : version
            }))
          }
          dispatch(updateSoundList({ sounds }))
        }
      }
      catch (e: unknown) {
        if (!cancelled) {
          alert(e)
        }
      }
      finally {
        stopListening?.()
        if (!cancelled && shouldDownload) {
          setIsDownloading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [SelectedVersion, dispatch, selectedVersionDownloaded])

  const versionRows = useMemo<VersionRow[]>(() => {
    const major_versions = versions.filter(v => v.kind === 'release').sort(compareReleaseVersionInfo).reverse()
    const snapshot_versions = versions.filter(v => v.kind === 'snapshot').sort(compareSnapshotVersionInfo).reverse()
    const pre_versions = versions.filter(v => v.kind === 'pre-release').sort(comparePreReleaseVersionInfo).reverse()
    const rc_versions = versions.filter(v => v.kind === 'release-candidate').sort(compareReleaseCandidateVersionInfo).reverse()
    return [
      { type: 'heading', label: t('release_version') },
      ...major_versions.map(version => ({ type: 'version', version }) as const),
      { type: 'heading', label: t('snapshot_version') },
      ...[...rc_versions, ...pre_versions, ...snapshot_versions].map(version => ({ type: 'version', version }) as const),
    ]
  }, [t, versions])

  const onChangeVersion = useCallback((version: string) => {
    setSelectedVersion(version)
    window.myAPI.setSetting('selectedVersion', version)
    const parsedVersion = parseVersion(version)
    dispatch(updateTargetVersion({ targetVersion: parsedVersion }))
  }, [dispatch])

  return (
    <HStack gap={2}>
      <VirtualVersionSelect
        disabled={isDownloading}
        onChange={onChangeVersion}
        placeholder={t('version_select')}
        rows={versionRows}
        value={SelectedVersion}
      />
      {isDownloading && (
        <HStack gap={1} whiteSpace="nowrap">
          <Text fontSize="sm">
            {downloadProgress
              ? t('asset_downloading_progress', {
                  completed: downloadProgress.completedAssets,
                  total: downloadProgress.totalAssets,
                })
              : t('asset_downloading')}
          </Text>
        </HStack>
      )}
    </HStack>
  )
}
