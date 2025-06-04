import React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Select } from '@yamada-ui/react'
import { useAddDispatch } from '../../store/_store'
import { Sound, updateSoundList, updateTargetVersion } from '../../store/fetchSlice'
import { VersionInfoType, compareReleaseVersionInfo, compareSnapshotVersionInfo, comparePreReleaseVersionInfo, compareReleaseCandidateVersionInfo, parseVersion } from '../../types/VersionInfo'
import { useTranslation } from 'react-i18next'

export const VersionSelector = () => {
  const { t } = useTranslation()
  const dispatch = useAddDispatch()

  const [versions, setVersions] = useState<VersionInfoType[]>([])
  const [SelectedVersion, setSelectedVersion] = useState('')

  useEffect(() => {
    (async () => {
      const version = await window.myAPI.getSetting('selectedVersion') as VersionInfoType | undefined
      if (version) {
        setSelectedVersion(version.raw)
        dispatch(updateTargetVersion({ targetVersion: version }))
      }
    })()
  }, [dispatch])

  useEffect(() => {
    (async () => {
      const get_mcVersions = (versions: string[]): VersionInfoType[] => {
        return versions.map(parseVersion).filter((v): v is VersionInfoType => !!v)
      }
      try {
        const versions = await window.myAPI.get_versions()
        setVersions(get_mcVersions(versions))
      }
      catch (e: unknown) {
        alert(e)
      }
    })()
  }, [])

  const versionList = useMemo(() => {
    const major_versions = versions.filter(v => v.kind === 'release').sort(compareReleaseVersionInfo).reverse().map(v => v.raw)
    const snapshot_versions = versions.filter(v => v.kind === 'snapshot').sort(compareSnapshotVersionInfo).reverse().map(v => v.raw)
    const pre_versions = versions.filter(v => v.kind === 'pre-release').sort(comparePreReleaseVersionInfo).reverse().map(v => v.raw)
    const rc_versions = versions.filter(v => v.kind === 'release-candidate').sort(compareReleaseCandidateVersionInfo).reverse().map(v => v.raw)

    const f = async () => {
      try {
        if (SelectedVersion) {
          const sounds: Sound[] = await window.myAPI.get_mcSounds(SelectedVersion)
          dispatch(updateSoundList({ sounds }))
        }
      }
      catch (e: unknown) { alert(e) }
    }
    f()

    return [
      { label: t('release_version'), items: major_versions.map(v => ({ label: v, value: v })) },
      { label: t('snapshot_version'), items: [...rc_versions, ...pre_versions, ...snapshot_versions].map(v => ({ label: v, value: v })) },
    ]
  }, [dispatch, t, SelectedVersion, versions])

  const onChangeVersion = async (version: string) => {
    setSelectedVersion(version)
    dispatch(updateTargetVersion({ targetVersion: versions.find(v => v.raw == version) }))
    window.myAPI.updateSettings({ selectedVersion: versions.find(v => v.raw == version) })
    const sounds: Sound[] = await window.myAPI.get_mcSounds(version)
    dispatch(updateSoundList({ sounds }))
  }

  return (
    <>
      <Select
        placeholder={t('version_select')}
        placeholderInOptions={false}
        variant="filled"
        items={versionList}
        onChange={onChangeVersion}
        maxW="sm"
        animation="top"
        value={SelectedVersion}
        gutter={0}
        listProps={{ padding: 0, margin: 0 }}
        style={{ userSelect: 'none' }}
      />
    </>
  )
}
