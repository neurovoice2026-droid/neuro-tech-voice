'use client'

import { useCallback, useRef, type KeyboardEvent } from 'react'

// Keyboard behaviour of a native radio group for card pickers: one tab stop,
// arrow keys (and Home/End) move and select, Space/Enter select. Pair it with
// role="radiogroup" on the container.

export function useRovingRadio<T extends string>({
  values,
  value,
  onChange,
}: {
  /** Options currently rendered, in visual order. */
  values: readonly T[]
  value: T | '' | null
  onChange: (value: T) => void
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>())
  const selectedVisible = value !== null && value !== '' && values.includes(value as T)

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, current: T) => {
      const index = values.indexOf(current)
      if (index === -1 || values.length === 0) return
      let next: number
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = (index + 1) % values.length
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          next = (index - 1 + values.length) % values.length
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = values.length - 1
          break
        default:
          return
      }
      event.preventDefault()
      const target = values[next]
      onChange(target)
      refs.current.get(target)?.focus()
    },
    [values, onChange]
  )

  return function itemProps(item: T) {
    const checked = value === item
    return {
      type: 'button' as const,
      role: 'radio' as const,
      'aria-checked': checked,
      tabIndex: (selectedVisible ? checked : values[0] === item) ? 0 : -1,
      ref: (el: HTMLButtonElement | null) => {
        if (el) refs.current.set(item, el)
        else refs.current.delete(item)
      },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, item),
      onClick: () => onChange(item),
    }
  }
}
