import { describe, it, expect } from 'vitest'
import { computeDiff } from '@/lib/annotate'

describe('computeDiff', () => {
  it('returns hasChanges=false for identical strings', () => {
    const code = 'const x = 1\nconst y = 2'
    const result = computeDiff(code, code)
    expect(result.hasChanges).toBe(false)
    expect(result.addedLines).toHaveLength(0)
    expect(result.removedLines).toHaveLength(0)
    expect(result.changedLineNumbers).toHaveLength(0)
  })

  it('detects a single added line', () => {
    const prev = 'const x = 1'
    const curr = 'const x = 1\nconst y = 2'
    const result = computeDiff(prev, curr)
    expect(result.hasChanges).toBe(true)
    expect(result.addedLines).toContain('const y = 2')
    expect(result.changedLineNumbers).toContain(2)
  })

  it('detects a single removed line', () => {
    const prev = 'const x = 1\nconst y = 2'
    const curr = 'const x = 1'
    const result = computeDiff(prev, curr)
    expect(result.hasChanges).toBe(true)
    expect(result.removedLines).toContain('const y = 2')
    expect(result.changedLineNumbers).toContain(2)
  })

  it('detects a line modification (both added + removed)', () => {
    const prev = 'const x = 1\nconst y = 2'
    const curr = 'const x = 1\nconst y = 99'
    const result = computeDiff(prev, curr)
    expect(result.hasChanges).toBe(true)
    expect(result.addedLines).toContain('const y = 99')
    expect(result.removedLines).toContain('const y = 2')
    expect(result.changedLineNumbers).toEqual([2])
  })

  it('detects multiple changed lines', () => {
    const prev = 'line1\nline2\nline3'
    const curr = 'LINE1\nline2\nLINE3'
    const result = computeDiff(prev, curr)
    expect(result.changedLineNumbers).toEqual([1, 3])
    expect(result.addedLines).toContain('LINE1')
    expect(result.addedLines).toContain('LINE3')
  })

  it('returns empty string snippet when both strings are empty', () => {
    const result = computeDiff('', '')
    expect(result.hasChanges).toBe(false)
    expect(result.snippet).toBe('')
  })

  it('snippet contains lines around the first change', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`)
    const prev  = lines.join('\n')
    const curr  = [...lines.slice(0, 10), 'CHANGED', ...lines.slice(11)].join('\n')
    const result = computeDiff(prev, curr)
    expect(result.snippet).toContain('CHANGED')
    expect(result.changedLineNumbers).toContain(11)
  })

  it('treats empty prev as all-added', () => {
    const result = computeDiff('', 'function hello() {}')
    expect(result.hasChanges).toBe(true)
    expect(result.addedLines).toContain('function hello() {}')
    expect(result.removedLines).toHaveLength(0)
  })

  it('treats empty curr as all-removed', () => {
    const result = computeDiff('function hello() {}', '')
    expect(result.hasChanges).toBe(true)
    expect(result.removedLines).toContain('function hello() {}')
    expect(result.addedLines).toHaveLength(0)
  })
})
