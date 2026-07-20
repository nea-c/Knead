import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { UIProvider } from '@yamada-ui/react'
import '../i18n/configs'
import { AudioSelectDropdown } from '../Sub/components/AudioSelectDropdown'
import { VirtualVersionSelect } from '../Main/VersionSelector'
import { buildGroupedVersionRows, filterVersionRows, getInitialVirtualSelectQuery, getInitialVirtualSelectState, matchesVirtualSelectQuery } from './virtualSelectSearch'
import {
  VIRTUAL_SELECT_DISABLED_OPACITY,
  VIRTUAL_SELECT_ITEM_HEIGHT,
  getVirtualSelectItemState,
  isVirtualSelectPopupVisible,
  virtualSelectActiveItemProps,
  virtualSelectClearButtonProps,
  virtualSelectEmptyProps,
  virtualSelectItemProps,
  virtualSelectMenuProps,
  virtualSelectPopupMotionProps,
  virtualSelectSelectedItemProps,
  virtualSelectTriggerProps,
} from './virtualSelectStyles'

export function _selfCheckVirtualSelectDropdowns(): void {
  const versionRows: React.ComponentProps<typeof VirtualVersionSelect>['rows'] = [
    { type: 'heading', label: 'Release' },
    { type: 'version', version: { raw: '1.21.1', kind: 'release', major: 1, minor: 21, patch: 1, downloaded: true } },
    { type: 'heading', label: 'Snapshots' },
    { type: 'version', version: { raw: '24w10a', kind: 'snapshot', year: 24, releaseNumber: 10, letter: 'a', downloaded: false } },
    { type: 'version', version: { raw: '24w11b', kind: 'snapshot', year: 24, releaseNumber: 11, letter: 'b', downloaded: false } },
  ]

  assert.equal(getInitialVirtualSelectQuery(['1.21.1'], '1.21.1'), '1.21.1')
  assert.equal(getInitialVirtualSelectQuery(['1.21.1'], 'stale-version'), '')
  assert.equal(getInitialVirtualSelectQuery(['1.21.1'], ''), '')
  const availableInitialState = getInitialVirtualSelectState(['1.21.1', '1.21.2'], '1.21.1')
  assert.deepEqual(availableInitialState, { inputValue: '1.21.1', query: '' })
  assert.deepEqual(filterVersionRows(versionRows, availableInitialState.query).flatMap(row => row.type === 'version' ? [row.version.raw] : []), ['1.21.1', '24w10a', '24w11b'])
  assert.deepEqual(getInitialVirtualSelectState(['1.21.1'], 'stale-version'), { inputValue: '', query: '' })
  assert.deepEqual(getInitialVirtualSelectState(['1.21.1'], ''), { inputValue: '', query: '' })
  assert.deepEqual(buildGroupedVersionRows([
    { label: 'Release', versions: [] },
    { label: 'Snapshots', versions: [{ raw: '24w10a' }] },
  ]), [
    { type: 'heading', label: 'Snapshots' },
    { type: 'version', version: { raw: '24w10a' } },
  ])
  assert.deepEqual(buildGroupedVersionRows([
    { label: 'Release', versions: [{ raw: '1.21.1' }] },
    { label: 'Snapshots', versions: [] },
  ]), [
    { type: 'heading', label: 'Release' },
    { type: 'version', version: { raw: '1.21.1' } },
  ])
  assert.equal(matchesVirtualSelectQuery('Minecraft 1.21.1', 'minecraft 21.1'), true)
  assert.equal(matchesVirtualSelectQuery('Minecraft 1.21.1', 'minecraft 24w'), false)
  assert.deepEqual(filterVersionRows(versionRows, ''), versionRows)
  assert.deepEqual(filterVersionRows(versionRows, '24w'), [
    { type: 'heading', label: 'Snapshots' },
    { type: 'version', version: { raw: '24w10a', kind: 'snapshot', year: 24, releaseNumber: 10, letter: 'a', downloaded: false } },
    { type: 'version', version: { raw: '24w11b', kind: 'snapshot', year: 24, releaseNumber: 11, letter: 'b', downloaded: false } },
  ])

  const versionHtml = renderToStaticMarkup(
    <UIProvider>
      <VirtualVersionSelect
        disabled={false}
        onChange={() => undefined}
        placeholder="Select version"
        rows={versionRows}
        value="1.21.1"
      />
    </UIProvider>,
  )

  assert.match(versionHtml, /<input[^>]*role="combobox"/)
  assert.doesNotMatch(versionHtml, /data-virtual-select-status-icon="start"/)
  assert.match(versionHtml, /data-virtual-select-chevron="end"/)

  const disabledVersionHtml = renderToStaticMarkup(
    <UIProvider>
      <VirtualVersionSelect
        disabled
        onChange={() => undefined}
        placeholder="Select version"
        rows={versionRows}
        value="1.21.1"
      />
    </UIProvider>,
  )

  assert.doesNotMatch(disabledVersionHtml, /data-virtual-select-status-icon="start"/)
  assert.equal(disabledVersionHtml.match(/opacity:0\.4/g)?.length, 2)

  assert.equal((virtualSelectTriggerProps as { paddingTop?: string }).paddingTop, '2px')

  assert.equal(VIRTUAL_SELECT_ITEM_HEIGHT, 36)
  assert.equal((virtualSelectItemProps as { py?: string }).py, '1.5')
  assert.equal(VIRTUAL_SELECT_DISABLED_OPACITY, 0.4)
  assert.equal(isVirtualSelectPopupVisible(true, 0), false)
  assert.equal(isVirtualSelectPopupVisible(true, 1), true)
  assert.equal(isVirtualSelectPopupVisible(false, 1), false)
  assert.equal(virtualSelectTriggerProps.minH, '10')
  assert.equal(virtualSelectTriggerProps.rounded, 'md')
  assert.equal(virtualSelectMenuProps.rounded, 'md')
  assert.equal(virtualSelectPopupMotionProps.duration, 0.2)
  assert.equal(virtualSelectPopupMotionProps.scale, 1)
  assert.equal(virtualSelectPopupMotionProps.transformOrigin, 'top center')
  assert.equal(virtualSelectClearButtonProps.rounded, 'sm')
  assert.equal(virtualSelectEmptyProps.color, 'muted')
  assert.equal(virtualSelectEmptyProps.minH, VIRTUAL_SELECT_ITEM_HEIGHT)
  assert.deepEqual(virtualSelectMenuProps.bg, ['white', 'black'])
  assert.deepEqual(virtualSelectActiveItemProps.bg, ['blackAlpha.100', 'whiteAlpha.100'])
  assert.deepEqual(virtualSelectSelectedItemProps.bg, ['blackAlpha.100', 'whiteAlpha.100'])
  assert.equal(getVirtualSelectItemState(false, false), 'idle')
  assert.equal(getVirtualSelectItemState(false, true), 'active')
  assert.equal(getVirtualSelectItemState(true, false), 'selected')
  assert.equal(getVirtualSelectItemState(true, true), 'selected')

  const html = renderToStaticMarkup(
    <UIProvider>
      <AudioSelectDropdown
        options={['minecraft:block.note_block.harp']}
        value="minecraft:block.note_block.harp"
        onSelect={() => undefined}
      />
    </UIProvider>,
  )

  assert.match(html, /role="combobox"/)
  assert.match(html, /aria-haspopup="listbox"/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /aria-controls="[^"]+"/)
  assert.match(html, /<input[^>]*aria-label="Sound"[^>]*role="combobox"|<input[^>]*role="combobox"[^>]*aria-label="Sound"/)

  const disabledHtml = renderToStaticMarkup(
    <UIProvider>
      <AudioSelectDropdown
        isDisabled
        options={['minecraft:block.note_block.harp']}
        value="minecraft:block.note_block.harp"
        onSelect={() => undefined}
      />
    </UIProvider>,
  )

  assert.equal(disabledHtml.match(/opacity:0\.4/g)?.length, 2)
}
