import React, { useEffect, useState } from 'react'
import { Box, Flex, Button } from '@yamada-ui/react'
import { useAddDispatch, useAppSelector } from '../../store/_store'
import { updateSoundList, updateTargetVersion } from '../../store/fetchSlice'
import { AudioControlWindow } from './components/AudioControlWindow'
import { TimelineEditor } from './components/TimelineEditor'
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

  const [mode, setMode] = useState<'group' | 'timeline'>('timeline')

  return (
    <Box display="flex" flexDir="column" h="100vh">
      <Flex bg="gray.900" p="1" gap="1" borderBottom="1px solid" borderColor="gray.700">
        <Button size="xs" colorScheme={mode === 'timeline' ? 'blue' : 'gray'} onClick={() => setMode('timeline')}>タイムライン</Button>
        <Button size="xs" colorScheme={mode === 'group' ? 'blue' : 'gray'} onClick={() => setMode('group')}>グループ (旧)</Button>
      </Flex>
      <Box flex="1" overflow="hidden">
        {mode === 'timeline'
          ? <TimelineEditor defaultSoundId={mainSelectedId} />
          : <AudioControlWindow mainSelectedId={mainSelectedId} />}
      </Box>
    </Box>
  )
}
