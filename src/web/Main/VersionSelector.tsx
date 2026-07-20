import React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, HStack, Text, useColorModeValue } from '@yamada-ui/react'
import { useAddDispatch } from '../../store/_store'
import { Sound, updateSoundList, updateTargetVersion } from '../../store/fetchSlice'
import { VersionInfoType, compareReleaseVersionInfo, compareSnapshotVersionInfo, comparePreReleaseVersionInfo, compareReleaseCandidateVersionInfo, parseVersion } from '../../types/VersionInfo'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
import { ChevronDownIcon, CircleCheckIcon, DownloadIcon } from '@yamada-ui/lucide'
import { FixedSizeList as VirtualList, ListChildComponentProps } from 'react-window'

type AssetDownloadProgress = {
  version: string
  completedAssets: number
  totalAssets: number
}

type AvailableVersion = VersionInfoType & {
  downloaded: boolean
}

type VersionRow =
  | { type: 'heading', label: string }
  | { type: 'version', version: AvailableVersion }

type VersionRowData = {
  activeIndex: number
  headingColor: string
  hoverBackground: string
  rows: VersionRow[]
  selectedBackground: string
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

const VERSION_ROW_HEIGHT = 36
const VERSION_LIST_HEIGHT = VERSION_ROW_HEIGHT * 8

const VersionStatusIcon = ({ downloaded }: { downloaded: boolean }) => downloaded
  ? <CircleCheckIcon aria-hidden color="green.500" fontSize="md" />
  : <DownloadIcon aria-hidden color="gray.500" fontSize="md" />

const VirtualVersionRow = React.memo(({ index, style, data }: ListChildComponentProps<VersionRowData>) => {
  const row = data.rows[index]
  if (row.type === 'heading') {
    return (
      <Box
        style={style}
        color={data.headingColor}
        fontSize="sm"
        fontWeight="semibold"
        paddingX={3}
        paddingY={2}
        role="presentation"
      >
        {row.label}
      </Box>
    )
  }

  const selected = row.version.raw === data.selectedVersion
  const active = index === data.activeIndex
  return (
    <HStack
      aria-selected={selected}
      bg={selected ? data.selectedBackground : active ? data.hoverBackground : 'transparent'}
      cursor="pointer"
      gap={2}
      onClick={() => data.onSelect(row.version.raw)}
      onMouseEnter={() => data.onActivate(index)}
      paddingX={3}
      role="option"
      style={style}
      title={row.version.raw}
      userSelect="none"
    >
      <VersionStatusIcon downloaded={row.version.downloaded} />
      <Text overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {row.version.raw}
      </Text>
    </HStack>
  )
})
VirtualVersionRow.displayName = 'VirtualVersionRow'

const VirtualVersionSelect = ({ disabled, placeholder, rows, value, onChange }: VirtualVersionSelectProps) => {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<VirtualList>(null)
  const menuBackground = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const hoverBackground = useColorModeValue('gray.100', 'gray.700')
  const selectedBackground = useColorModeValue('blue.50', 'gray.600')
  const headingColor = useColorModeValue('gray.600', 'gray.300')
  const selectedVersion = useMemo(() => {
    const row = rows.find((row): row is Extract<VersionRow, { type: 'version' }> => {
      return row.type === 'version' && row.version.raw === value
    })
    return row?.version
  }, [rows, value])

  const firstVersionIndex = useMemo(() => rows.findIndex(row => row.type === 'version'), [rows])
  const selectedIndex = useMemo(() => rows.findIndex((row) => {
    return row.type === 'version' && row.version.raw === value
  }), [rows, value])

  const activate = useCallback((index: number) => {
    setActiveIndex(index)
    listRef.current?.scrollToItem(index, 'smart')
  }, [])

  const openList = useCallback(() => {
    const nextIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, firstVersionIndex)
    setActiveIndex(nextIndex)
    setOpen(true)
    requestAnimationFrame(() => listRef.current?.scrollToItem(nextIndex, 'smart'))
  }, [firstVersionIndex, selectedIndex])

  const selectVersion = useCallback((version: string) => {
    onChange(version)
    setOpen(false)
  }, [onChange])

  const moveActive = useCallback((direction: 1 | -1) => {
    let nextIndex = activeIndex
    do {
      nextIndex += direction
    } while (nextIndex >= 0 && nextIndex < rows.length && rows[nextIndex].type !== 'version')
    if (nextIndex < 0 || nextIndex >= rows.length) return
    activate(nextIndex)
  }, [activate, activeIndex, rows])

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
    if (disabled) setOpen(false)
  }, [disabled])

  const rowData = useMemo<VersionRowData>(() => ({
    activeIndex,
    headingColor,
    hoverBackground,
    rows,
    selectedBackground,
    selectedVersion: value,
    onActivate: activate,
    onSelect: selectVersion,
  }), [activeIndex, activate, headingColor, hoverBackground, rows, selectedBackground, selectVersion, value])

  return (
    <Box ref={containerRef} position="relative" width="14rem" zIndex={open ? 100 : undefined}>
      <Button
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        endIcon={<ChevronDownIcon transform={open ? 'rotate(180deg)' : undefined} transition="transform 0.15s" />}
        justifyContent="space-between"
        onClick={() => open ? setOpen(false) : openList()}
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
            const row = rows[activeIndex]
            if (row?.type === 'version') selectVersion(row.version.raw)
          }
          else if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
          }
        }}
        variant="filled"
        width="full"
      >
        <HStack gap={2} minW={0}>
          {selectedVersion && <VersionStatusIcon downloaded={selectedVersion.downloaded} />}
          <Text color={selectedVersion ? undefined : 'muted'} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {selectedVersion?.raw ?? placeholder}
          </Text>
        </HStack>
      </Button>
      {open && rows.length > 0 && (
        <Box
          bg={menuBackground}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="md"
          boxShadow="md"
          left={0}
          overflow="hidden"
          position="absolute"
          role="listbox"
          top="calc(100% + 4px)"
          width="full"
          zIndex={50}
        >
          <VirtualList
            height={Math.min(rows.length * VERSION_ROW_HEIGHT, VERSION_LIST_HEIGHT)}
            itemCount={rows.length}
            itemData={rowData}
            itemKey={(index, data) => {
              const row = data.rows[index]
              return row.type === 'heading' ? `heading-${row.label}` : row.version.raw
            }}
            itemSize={VERSION_ROW_HEIGHT}
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
