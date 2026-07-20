import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { UIProvider } from '@yamada-ui/react'
import { AudioSelectDropdown } from '../Sub/components/AudioSelectDropdown'
import {
  VIRTUAL_SELECT_ITEM_HEIGHT,
  getVirtualSelectItemState,
  virtualSelectActiveItemProps,
  virtualSelectMenuProps,
  virtualSelectSelectedItemProps,
  virtualSelectTriggerProps,
} from './virtualSelectStyles'

export function _selfCheckVirtualSelectDropdowns(): void {
  assert.equal(VIRTUAL_SELECT_ITEM_HEIGHT, 36)
  assert.equal(virtualSelectTriggerProps.minH, '10')
  assert.equal(virtualSelectTriggerProps.rounded, 'md')
  assert.equal(virtualSelectMenuProps.rounded, 'md')
  assert.deepEqual(virtualSelectMenuProps.bg, ['white', 'black'])
  assert.deepEqual(virtualSelectActiveItemProps.bg, ['blackAlpha.100', 'whiteAlpha.100'])
  assert.deepEqual(virtualSelectSelectedItemProps.bg, ['blackAlpha.200', 'whiteAlpha.200'])
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
}
