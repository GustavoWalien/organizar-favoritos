import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchBookmarks, type BookmarkEvents } from '../../src/chrome/watch'

function fakeEvents() {
  const listeners = new Map<string, Set<() => void>>()
  const make = (name: string) => {
    listeners.set(name, new Set())
    return { addListener: (cb: () => void) => listeners.get(name)!.add(cb), removeListener: (cb: () => void) => listeners.get(name)!.delete(cb) }
  }
  const events: BookmarkEvents = {
    onCreated: make('onCreated'), onRemoved: make('onRemoved'), onChanged: make('onChanged'),
    onMoved: make('onMoved'), onChildrenReordered: make('onChildrenReordered'), onImportEnded: make('onImportEnded'),
  }
  const fire = (name: string) => listeners.get(name)!.forEach((cb) => cb())
  const total = () => [...listeners.values()].reduce((n, s) => n + s.size, 0)
  return { events, fire, total }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('watchBookmarks', () => {
  it('várias mudanças seguidas chamam o aviso uma vez só, depois do atraso', () => {
    const { events, fire } = fakeEvents()
    const onChange = vi.fn()
    watchBookmarks(events, onChange, 250)
    fire('onCreated'); fire('onMoved'); fire('onMoved'); fire('onRemoved')
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(249)
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('uma mudança depois do atraso dispara de novo', () => {
    const { events, fire } = fakeEvents()
    const onChange = vi.fn()
    watchBookmarks(events, onChange, 100)
    fire('onChanged'); vi.advanceTimersByTime(100)
    fire('onImportEnded'); vi.advanceTimersByTime(100)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('escuta os seis tipos de evento', () => {
    const { events, fire } = fakeEvents()
    const onChange = vi.fn()
    watchBookmarks(events, onChange, 10)
    for (const name of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
      fire(name); vi.advanceTimersByTime(10)
    }
    expect(onChange).toHaveBeenCalledTimes(6)
  })

  it('a função devolvida remove os ouvintes e cancela o que estava pendente', () => {
    const { events, fire, total } = fakeEvents()
    const onChange = vi.fn()
    const stop = watchBookmarks(events, onChange, 100)
    expect(total()).toBe(6)
    fire('onMoved')
    stop()
    vi.advanceTimersByTime(500)
    expect(onChange).not.toHaveBeenCalled()
    expect(total()).toBe(0)
  })
})
