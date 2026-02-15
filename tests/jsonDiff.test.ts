import { describe, expect, it } from 'vitest'
import { applyDiffEntries, diffJson } from '../src/utils/jsonDiff'

describe('json diff utilities', () => {
  it('detects add/remove/replace diffs', () => {
    const current = { name: 'Alice', tags: ['a', 'b'], active: true }
    const incoming = { name: 'Bob', tags: ['a'], age: 30 }

    const diffs = diffJson(current, incoming)
    const kinds = diffs.map((entry) => entry.kind)

    expect(kinds).toContain('replace')
    expect(kinds).toContain('remove')
    expect(kinds).toContain('add')
  })

  it('applies selected diffs back to json', () => {
    const current = { profile: { name: 'Alice' }, tags: ['x'] }
    const incoming = { profile: { name: 'Bob' }, tags: ['x', 'y'] }
    const diffs = diffJson(current, incoming)

    const next = applyDiffEntries(current, diffs)
    expect(next).toEqual(incoming)
  })
})
