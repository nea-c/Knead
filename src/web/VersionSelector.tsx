import React, { useRef } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Select } from '@mantine/core'
import { useAddDispatch, useAppSelector } from '../store/_store'
import { Sound, updateSoundList, updateTargetVersion } from '../store/fetchSlice'
import { VersionInfoType, compareReleaseVersionInfo, compareSnapshotVersionInfo, comparePreReleaseVersionInfo, compareReleaseCandidateVersionInfo, parseVersion } from '../types/VersionInfo'
import { useTranslation } from 'react-i18next'
import { LuBox } from 'react-icons/lu'

const { myAPI } = window

export const VersionSelector = () => {
  const { t } = useTranslation()
  const dispatch = useAddDispatch()

  const targetVersion = useAppSelector(state => state.fetch.targetVersion)?.raw
  const [versions, setVersions] = useState<VersionInfoType[]>([])
  const [SelectedVersion, setSelectedVersion] = useState('')

  useEffect(() => {
    (async () => {
      const get_mcVersions = (versions: string[]): VersionInfoType[] => {
        return versions.map(parseVersion).filter((v): v is VersionInfoType => !!v)
      }
      try {
        const versions = await myAPI.get_versions()
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
        if (major_versions[0]) {
          if (!targetVersion) return
          const sounds: Sound[] = await myAPI.get_mcSounds(targetVersion)
          setSelectedVersion(targetVersion)
          dispatch(updateSoundList({ sounds }))
        }
      }
      catch (e: unknown) { alert(e) }
    }
    f()

    return [
      { group: t('release_version'), items: major_versions.map(v => ({ label: v, value: v })) },
      { group: t('snapshot_version'), items: [...rc_versions, ...pre_versions, ...snapshot_versions].map(v => ({ label: v, value: v })) },
    ]
  }, [dispatch, t, targetVersion, versions])

  const onChangeVersion = (value: string | null) => {
    const version = value ? value : ''

    setSelectedVersion(version)
    if (!versions.find(v => v.raw == version)) return
    dispatch(updateTargetVersion({ version: versions.find(v => v.raw == version) }))

    const f = async (target: string) => {
      try {
        const sounds: Sound[] = await myAPI.get_mcSounds(target)
        dispatch(updateSoundList({ sounds }))
      }
      catch (e: unknown) { alert(e) }
    }
  }

  return (
    <>
      <Select
        placeholder={t('version_select')}
        searchable
        // emptyMessage={t('version_not_found')}
        // closeOnSelect={false}
        variant="filled"
        data={versionList}
        size="sm"
        onChange={onChangeVersion}
        height={41}
        style={{ maxWidth: 'sm' }}
        value={SelectedVersion}
        comboboxProps={{ transitionProps: { transition: 'scale-y', duration: 200 } }}
        leftSection={<LuBox />}
      />
    </>
  )
}
