import { describe, expect, it } from 'vitest'
import { jsonPointerToJsonPath, validateJsonWithSchema } from '../src/utils/schemaValidation'

describe('schema validation utilities', () => {
  it('converts JSON Pointer paths to JSONPath', () => {
    expect(jsonPointerToJsonPath('/user/tags/0')).toBe('$.user.tags[0]')
    expect(jsonPointerToJsonPath('/user-data/name')).toBe("$['user-data'].name")
    expect(jsonPointerToJsonPath('')).toBe('$')
  })

  it('returns parse error when schema JSON is invalid', () => {
    const errors = validateJsonWithSchema('{invalid-json}', { name: 'Alice' })
    expect(errors).toHaveLength(1)
    expect(errors[0].keyword).toBe('schema-parse')
  })

  it('returns empty errors for valid document', () => {
    const schemaText = JSON.stringify({
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    })

    const errors = validateJsonWithSchema(schemaText, { name: 'Alice' })
    expect(errors).toEqual([])
  })

  it('returns mapped errors for invalid document', () => {
    const schemaText = JSON.stringify({
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    })

    const errors = validateJsonWithSchema(schemaText, {})
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].path).toBe('$.name')
  })
})
