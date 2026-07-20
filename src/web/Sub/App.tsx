import React, { useEffect, useState } from 'react'
import { useAddDispatch, useAppSelector } from '../../store/_store'
import { updateSoundList, updateTargetVersion } from '../../store/fetchSlice'
import { TimelineEditor } from './components/TimelineEditor'
import { parseVersion } from '../../types/VersionInfo'

export const SubApp = () => {
  const dispatch = useAddDispatch()
  const targetVersion = useAppSelector(s => s.fetch.targetVersion)

  useEffect(() => {
    ;(async () => {
      const setting = await window.myAPI.getSetting('selectedVersion')
      const rawVersion = typeof setting === 'string'
        ? setting
        : typeof setting === 'object' && setting !== null && 'raw' in setting && typeof setting.raw === 'string'
          ? setting.raw
          : undefined
      const version = rawVersion ? parseVersion(rawVersion) : undefined
      if (version) dispatch(updateTargetVersion({ targetVersion: version }))
    })()
  }, [dispatch])

  useEffect(() => {
    if (!targetVersion) return
    ;(async () => {
      const list = await window.myAPI.get_mcSounds(targetVersion.raw)
      dispatch(updateSoundList({ sounds: list }))
    })()
  }, [dispatch, targetVersion])

  useEffect(() => {
    ;(async () => {
      const list = await window.myAPI.getCurrentSounds()
      if (Array.isArray(list)) dispatch(updateSoundList({ sounds: list }))
    })()
  }, [dispatch])

  const [mainSelectedId, setMainSelectedId] = useState<string>('')
  useEffect(() => {
    const fetchMainSelectedId = async () => {
      const id = await window.myAPI.getMainSelectedSound()
      setMainSelectedId(id)
    }
    fetchMainSelectedId()
    const interval = setInterval(fetchMainSelectedId, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <TimelineEditor
      defaultSoundId={mainSelectedId}
      currentTargetVersion={targetVersion?.raw}
    />
  )
}
