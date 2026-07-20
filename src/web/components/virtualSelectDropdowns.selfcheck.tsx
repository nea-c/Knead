import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { UIProvider } from '@yamada-ui/react'
import { AudioSelectDropdown } from '../Sub/components/AudioSelectDropdown'
import {
  VIRTUAL_SELECT_DISABLED_OPACITY,
  VIRTUAL_SELECT_ITEM_HEIGHT,
  getVirtualSelectItemState,
  isVirtualSelectPopupVisible,
  virtualSelectActiveItemProps,
  virtualSelectItemProps,
  virtualSelectMenuProps,
  virtualSelectSelectedItemProps,
  virtualSelectTriggerProps,
} from './virtualSelectStyles'

export function _selfCheckVirtualSelectDropdowns(): void {
  assert.equal(VIRTUAL_SELECT_ITEM_HEIGHT, 36)
  assert.equal((virtualSelectItemProps as { py?: string }).py, '1.5')
  assert.equal(VIRTUAL_SELECT_DISABLED_OPACITY, 0.4)
  assert.equal(isVirtualSelectPopupVisible(true, 0), false)
  assert.equal(isVirtualSelectPopupVisible(true, 1), true)
  assert.equal(isVirtualSelectPopupVisible(false, 1), false)
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
