import assert from 'node:assert/strict'
/* eslint-disable @typescript-eslint/no-require-imports -- ReactDOM must initialize after jsdom installs browser globals. */
import type * as ReactTypes from 'react'
import type { Root } from 'react-dom/client'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost' })
Object.defineProperty(dom.window, 'matchMedia', {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
})
let nextAnimationFrameId = 0
const animationFrames = new Map<number, FrameRequestCallback>()
const requestAnimationFrame = (callback: FrameRequestCallback) => {
  nextAnimationFrameId += 1
  animationFrames.set(nextAnimationFrameId, callback)
  return nextAnimationFrameId
}
const cancelAnimationFrame = (id: number) => {
  animationFrames.delete(id)
}
function flushAnimationFrame(): void {
  const callbacks = [...animationFrames.values()]
  animationFrames.clear()
  act(() => {
    for (const callback of callbacks) callback(0)
  })
}
const globalValues = {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  localStorage: dom.window.localStorage,
  sessionStorage: dom.window.sessionStorage,
  Node: dom.window.Node,
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  SVGElement: dom.window.SVGElement,
  Event: dom.window.Event,
  MouseEvent: dom.window.MouseEvent,
  KeyboardEvent: dom.window.KeyboardEvent,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame,
  cancelAnimationFrame,
  IS_REACT_ACT_ENVIRONMENT: true,
}
for (const [name, value] of Object.entries(globalValues)) {
  Object.defineProperty(globalThis, name, { configurable: true, value, writable: true })
}

const React = require('react') as typeof import('react')
const { act } = React
const { createRoot } = require('react-dom/client') as typeof import('react-dom/client')
const { UIProvider } = require('@yamada-ui/react') as typeof import('@yamada-ui/react')
require('../i18n/configs')
const { VirtualVersionSelect } = require('../Main/VersionSelector') as typeof import('../Main/VersionSelector')
const { AudioSelectDropdown } = require('../Sub/components/AudioSelectDropdown') as typeof import('../Sub/components/AudioSelectDropdown')

const versionRows: ReactTypes.ComponentProps<typeof VirtualVersionSelect>['rows'] = [
  { type: 'heading', label: 'Release' },
  { type: 'version', version: { raw: '1.21.1', kind: 'release', major: 1, minor: 21, patch: 1, downloaded: true } },
  { type: 'heading', label: 'Snapshots' },
  { type: 'version', version: { raw: '24w10a', kind: 'snapshot', year: 24, releaseNumber: 10, letter: 'a', downloaded: false } },
  { type: 'version', version: { raw: '24w11b', kind: 'snapshot', year: 24, releaseNumber: 11, letter: 'b', downloaded: false } },
]

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })
}

function keyDown(element: Element, key: string): void {
  act(() => {
    element.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, key }))
  })
}

function input(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  assert.ok(setter)
  act(() => {
    setter.call(element, value)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

function mount(element: ReactTypes.ReactNode): { container: HTMLDivElement, root: Root, unmount: () => void } {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => root.render(<UIProvider>{element}</UIProvider>))
  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

function getCombobox(container: Element): HTMLInputElement {
  const combobox = container.querySelector<HTMLInputElement>('input[role="combobox"]')
  assert.ok(combobox)
  return combobox
}

function assertPopupExiting(container: Element, combobox: HTMLInputElement): void {
  assert.equal(combobox.getAttribute('aria-expanded'), 'false')
  const popup = container.querySelector<HTMLElement>('[data-virtual-select-popup]')
  assert.ok(popup)
  assert.equal(popup.getAttribute('aria-hidden'), 'true')
}

function checkVersionInteractions(): void {
  let selected = ''
  const mounted = mount(
    <VirtualVersionSelect
      disabled={false}
      onChange={(version) => { selected = version }}
      placeholder="Select version"
      rows={versionRows}
      value="1.21.1"
    />,
  )
  const combobox = getCombobox(mounted.container)

  click(combobox)
  assert.equal(combobox.getAttribute('aria-expanded'), 'true')
  assert.ok(mounted.container.querySelector('[data-virtual-select-popup].ui-fade-scale'))
  assert.equal(mounted.container.querySelectorAll('[role="option"]').length, 3)
  assert.equal(mounted.container.querySelectorAll('[role="option"] svg').length, 3)

  input(combobox, 'missing')
  assert.equal(combobox.getAttribute('aria-expanded'), 'true')
  assert.ok(mounted.container.querySelector('[data-virtual-select-empty]'))
  assert.equal(mounted.container.querySelectorAll('[role="option"]').length, 0)
  assert.equal(mounted.container.querySelector('[data-virtual-select-chevron]'), null)
  const clear = mounted.container.querySelector('[data-virtual-select-clear]')
  assert.ok(clear)
  click(clear)
  assert.equal(combobox.value, '')
  assert.equal(combobox.getAttribute('aria-expanded'), 'true')
  assert.equal(mounted.container.querySelectorAll('[role="option"]').length, 3)
  assert.equal(selected, '')

  keyDown(combobox, 'ArrowDown')
  assert.match(combobox.getAttribute('aria-activedescendant') ?? '', /option-3$/)
  keyDown(combobox, 'Enter')
  assert.equal(selected, '24w10a')
  assertPopupExiting(mounted.container, combobox)

  click(combobox)
  input(combobox, '24w11')
  assert.equal(mounted.container.querySelectorAll('[role="option"]').length, 1)
  assert.match(mounted.container.querySelector('[role="option"]')?.textContent ?? '', /24w11b/)
  keyDown(combobox, 'Escape')
  assertPopupExiting(mounted.container, combobox)
  mounted.unmount()

  const stale = mount(
    <VirtualVersionSelect
      disabled={false}
      onChange={() => undefined}
      placeholder="Select version"
      rows={versionRows}
      value="stale-version"
    />,
  )
  const staleCombobox = getCombobox(stale.container)
  click(staleCombobox)
  assert.equal(staleCombobox.value, '')
  assert.equal(stale.container.querySelectorAll('[role="option"]').length, 3)
  stale.unmount()
}

function checkSoundInteractions(): void {
  const options = [
    'minecraft:block.note_block.harp',
    'minecraft:block.note_block.bell',
    'minecraft:block.note_block.bass',
  ]
  const selections: string[] = []
  const mounted = mount(
    <AudioSelectDropdown
      onSelect={value => selections.push(value)}
      options={options}
      value="minecraft:block.note_block.harp"
    />,
  )
  const combobox = getCombobox(mounted.container)

  click(combobox)
  assert.equal(mounted.container.querySelectorAll('[role="option"]').length, 3)
  assert.ok(mounted.container.querySelector('[data-virtual-select-popup].ui-fade-scale'))
  assert.ok(mounted.container.querySelector('[data-virtual-select-clear]'))
  input(combobox, 'missing')
  assert.equal(combobox.getAttribute('aria-expanded'), 'true')
  assert.ok(mounted.container.querySelector('[data-virtual-select-empty]'))
  assert.equal(mounted.container.querySelectorAll('[role="option"]').length, 0)
  const clear = mounted.container.querySelector('[data-virtual-select-clear]')
  assert.ok(clear)
  click(clear)
  assert.equal(combobox.value, '')
  assert.equal(combobox.getAttribute('aria-expanded'), 'true')
  assert.equal(mounted.container.querySelectorAll('[role="option"]').length, 3)
  assert.deepEqual(selections, [])

  input(combobox, 'bell')
  assert.equal(mounted.container.querySelectorAll('[role="option"]').length, 1)
  click(mounted.container.querySelector('[role="option"]') as Element)
  assert.deepEqual(selections, ['minecraft:block.note_block.bell'])

  click(combobox)
  keyDown(combobox, 'ArrowDown')
  keyDown(combobox, 'Enter')
  assert.deepEqual(selections, [
    'minecraft:block.note_block.bell',
    'minecraft:block.note_block.bell',
  ])

  click(combobox)
  keyDown(combobox, 'Escape')
  assertPopupExiting(mounted.container, combobox)
  click(combobox)
  act(() => {
    document.body.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }))
  })
  assertPopupExiting(mounted.container, combobox)
  mounted.unmount()

  let handled = 0
  const focused = mount(
    <AudioSelectDropdown
      focusRequest={1}
      onFocusRequestHandled={() => { handled += 1 }}
      onSelect={() => undefined}
      options={options}
      value="minecraft:block.note_block.harp"
    />,
  )
  const focusedCombobox = getCombobox(focused.container)
  flushAnimationFrame()
  assert.equal(document.activeElement, focusedCombobox)
  assert.equal(focusedCombobox.getAttribute('aria-expanded'), 'true')
  assert.equal(focused.container.querySelectorAll('[role="option"]').length, 3)
  assert.equal(handled, 1)
  focused.unmount()
}

function checkVersionInstanceIds(): void {
  const mounted = mount(
    <>
      <VirtualVersionSelect disabled={false} onChange={() => undefined} placeholder="One" rows={versionRows} value="1.21.1" />
      <VirtualVersionSelect disabled={false} onChange={() => undefined} placeholder="Two" rows={versionRows} value="24w10a" />
    </>,
  )
  const comboboxes = [...mounted.container.querySelectorAll<HTMLInputElement>('input[role="combobox"]')]
  assert.equal(comboboxes.length, 2)
  const controls = comboboxes.map(combobox => combobox.getAttribute('aria-controls'))
  assert.equal(new Set(controls).size, 2)
  for (const combobox of comboboxes) click(combobox)
  const listboxIds = [...mounted.container.querySelectorAll('[role="listbox"]')].map(listbox => listbox.id)
  assert.equal(listboxIds.length, 2)
  assert.equal(new Set(listboxIds).size, 2)
  const optionIds = [...mounted.container.querySelectorAll('[role="option"]')].map(option => option.id)
  assert.equal(new Set(optionIds).size, optionIds.length)
  mounted.unmount()
}

function selfCheckVirtualSelectDropdownDom(): void {
  try {
    checkVersionInteractions()
    checkSoundInteractions()
    checkVersionInstanceIds()
  }
  finally {
    dom.window.close()
  }
}

selfCheckVirtualSelectDropdownDom()
