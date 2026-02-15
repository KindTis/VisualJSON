import { describe, expect, it } from 'vitest'
import { astToJson, jsonToAst } from '../src/utils/parser'
import type { JsonDocument } from '../src/types'

describe('parser utilities', () => {
  it('converts JSON to AST and preserves node relationships', () => {
    const input = {
      title: 'VisualJSON',
      settings: {
        autoSave: true,
      },
      items: [1, null],
    }

    const ast = jsonToAst(input)
    const root = ast.nodes[ast.rootId]

    expect(root.type).toBe('object')
    expect(root.children).toHaveLength(3)

    const children = (root.children ?? []).map((id) => ast.nodes[id])
    expect(children.map((node) => node.key)).toEqual(['title', 'settings', 'items'])
    expect(children.every((node) => node.parentId === ast.rootId)).toBe(true)
  })

  it('round-trips AST to JSON for nested objects and arrays', () => {
    const input = {
      profile: {
        name: 'Alice',
        age: 30,
      },
      tags: ['editor', 'json'],
      enabled: false,
      nullable: null,
    }

    const ast = jsonToAst(input)
    const output = astToJson(ast)

    expect(output).toEqual(input)
  })

  it('returns null when root node is missing', () => {
    const malformedDoc: JsonDocument = {
      rootId: 'missing-root',
      nodes: {},
    }

    expect(astToJson(malformedDoc)).toBeNull()
  })
})
