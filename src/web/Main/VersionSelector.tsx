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
        // const versions = ["1.21", "1.21.2", "1.42.3", "1.19", "1.21.4", "Ffff-1.3.421.21", "22.31.321", "22...31.321", "1.19.3-rc3", "1.19.3-pre2", "", "1.13.1-pre2", "1.13.1-pre1", "23w44a", "12w3421a", "1.1232-foa", "a-tr-test-1.32116.325-1.21", "23w13a_or_b", "1.19.2-AAA_DSA_GA_H2", "3.28.1-aaaasd21.3.3-41.5555.3.32118-3.3.3"]
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
