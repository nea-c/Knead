import React, { useEffect, useState } from 'react'
import { useAddDispatch, useAppSelector } from '../../store/_store'
import { updateSoundList, updateTargetVersion } from '../../store/fetchSlice'
import { AudioControlWindow } from './components/AudioControlWindow'
import { VersionInfoType } from '../../types/VersionInfo'

export const SubApp = () => {
  const dispatch = useAddDispatch()
  const targetVersion = useAppSelector(s => s.fetch.targetVersion)
  const sounds = useAppSelector(s => s.fetch.sounds)
  const selectedSound = useAppSelector(s => s.fetch.selectedSound)

  useEffect(() => {
    ;(async () => {
      const version = await window.myAPI.getSetting('selectedVersion')
      if (version) dispatch(updateTargetVersion({ targetVersion: version as VersionInfoType }))
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

  // メインウィンドウで選択中のIDを取得
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
    <AudioControlWindow mainSelectedId={mainSelectedId} />
  )
}
