import { beforeEach, describe, expect, it } from 'vitest'
import { jsonToAst } from '../src/utils/parser'
import { useJsonStore } from '../src/store/useJsonStore'
import type { JsonDocument, JsonNode } from '../src/types'

const resetStore = () => {
  useJsonStore.setState(useJsonStore.getInitialState(), true)
}

const getDocument = (): JsonDocument => {
  const doc = useJsonStore.getState().document
  if (!doc) {
    throw new Error('Document must be initialized before assertions')
  }
  return doc
}

const findNodeByKey = (doc: JsonDocument, key: string): JsonNode => {
  const node = Object.values(doc.nodes).find((candidate) => candidate.key === key)
  if (!node) {
    throw new Error(`Node with key "${key}" not found`)
  }
  return node
}

describe('useJsonStore', () => {
  beforeEach(() => {
    resetStore()
  })

  it('setDocument resets selection, search, and history while expanding root', () => {
    const firstDoc = jsonToAst({ name: 'Alice' })
    const secondDoc = jsonToAst({ title: 'VisualJSON' })

    const store = useJsonStore.getState()
    store.setDocument(firstDoc)

    const nameNode = findNodeByKey(getDocument(), 'name')
    store.selectNode(nameNode.id)
    store.setSearchQuery('alice')
    store.updateNodeValue(nameNode.id, 'Bob')

    store.setDocument(secondDoc)

    const state = useJsonStore.getState()
    expect(state.selectedId).toBeNull()
    expect(state.searchQuery).toBe('')
    expect(state.searchResults).toEqual([])
    expect(state.currentSearchIndex).toBe(-1)
    expect(state.undoStack).toHaveLength(0)
    expect(state.redoStack).toHaveLength(0)
    expect(state.expandedIds.has(secondDoc.rootId)).toBe(true)
    expect(state.expandedIds.size).toBe(1)
  })

  it('searches by key/value and navigates results', () => {
    const doc = jsonToAst({
      one: 'target-1',
      two: 'target-2',
      nested: { three: 'TARGET-3' },
    })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    store.setSearchQuery('target')

    const stateAfterSearch = useJsonStore.getState()
    expect(stateAfterSearch.searchResults).toHaveLength(3)
    expect(stateAfterSearch.currentSearchIndex).toBe(0)
    expect(stateAfterSearch.selectedId).toBe(stateAfterSearch.searchResults[0])

    store.nextSearchResult()
    const stateAfterNext = useJsonStore.getState()
    expect(stateAfterNext.currentSearchIndex).toBe(1)
    expect(stateAfterNext.selectedId).toBe(stateAfterNext.searchResults[1])

    store.prevSearchResult()
    const stateAfterPrev = useJsonStore.getState()
    expect(stateAfterPrev.currentSearchIndex).toBe(0)
    expect(stateAfterPrev.selectedId).toBe(stateAfterPrev.searchResults[0])
  })

  it('updates node values and supports undo/redo', () => {
    const doc = jsonToAst({ title: 'Draft' })
    useJsonStore.getState().setDocument(doc)

    const titleNode = findNodeByKey(getDocument(), 'title')
    const store = useJsonStore.getState()

    store.updateNodeValue(titleNode.id, 'Published')
    expect(getDocument().nodes[titleNode.id].value).toBe('Published')

    store.undo()
    expect(getDocument().nodes[titleNode.id].value).toBe('Draft')

    store.redo()
    expect(getDocument().nodes[titleNode.id].value).toBe('Published')
  })

  it('adds and deletes nodes with undo/redo support', () => {
    const doc = jsonToAst({ items: [] as string[] })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const itemsNode = findNodeByKey(getDocument(), 'items')
    const initialCount = getDocument().nodes[itemsNode.id].children?.length ?? 0

    store.addNode(itemsNode.id, 'string')

    const childrenAfterAdd = getDocument().nodes[itemsNode.id].children ?? []
    expect(childrenAfterAdd).toHaveLength(initialCount + 1)

    const addedNodeId = childrenAfterAdd[childrenAfterAdd.length - 1]
    expect(getDocument().nodes[addedNodeId].value).toBe('')

    store.deleteNode(addedNodeId)
    const childrenAfterDelete = getDocument().nodes[itemsNode.id].children ?? []
    expect(childrenAfterDelete).toHaveLength(initialCount)

    store.undo()
    const childrenAfterUndo = getDocument().nodes[itemsNode.id].children ?? []
    expect(childrenAfterUndo).toContain(addedNodeId)

    store.redo()
    const childrenAfterRedo = getDocument().nodes[itemsNode.id].children ?? []
    expect(childrenAfterRedo).not.toContain(addedNodeId)
  })

  it('renames object keys and tracks changes in undo/redo stacks', () => {
    const doc = jsonToAst({ user: { name: 'Alice' } })
    useJsonStore.getState().setDocument(doc)

    const nameNode = findNodeByKey(getDocument(), 'name')
    const store = useJsonStore.getState()

    store.renameNodeKey(nameNode.id, 'fullName')
    expect(getDocument().nodes[nameNode.id].key).toBe('fullName')

    store.undo()
    expect(getDocument().nodes[nameNode.id].key).toBe('name')

    store.redo()
    expect(getDocument().nodes[nameNode.id].key).toBe('fullName')
  })

  it('changes node type with safe defaults and supports undo/redo', () => {
    const doc = jsonToAst({ title: 'Draft' })
    useJsonStore.getState().setDocument(doc)

    const titleNode = findNodeByKey(getDocument(), 'title')
    const store = useJsonStore.getState()

    store.changeNodeType(titleNode.id, 'number')
    expect(getDocument().nodes[titleNode.id].type).toBe('number')
    expect(getDocument().nodes[titleNode.id].value).toBe(0)
    expect(getDocument().nodes[titleNode.id].children).toBeUndefined()

    store.undo()
    expect(getDocument().nodes[titleNode.id].type).toBe('string')
    expect(getDocument().nodes[titleNode.id].value).toBe('Draft')

    store.redo()
    expect(getDocument().nodes[titleNode.id].type).toBe('number')
    expect(getDocument().nodes[titleNode.id].value).toBe(0)
  })

  it('removes subtree when converting object to primitive and restores on undo', () => {
    const doc = jsonToAst({ profile: { name: 'Alice', age: 30 } })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const profileNode = findNodeByKey(getDocument(), 'profile')
    const childIds = [...(getDocument().nodes[profileNode.id].children ?? [])]
    expect(childIds.length).toBeGreaterThan(0)

    store.toggleExpand(childIds[0], true)
    store.changeNodeType(profileNode.id, 'string')

    const stateAfterChange = useJsonStore.getState()
    expect(getDocument().nodes[profileNode.id].type).toBe('string')
    expect(getDocument().nodes[profileNode.id].value).toBe('')
    childIds.forEach((childId) => {
      expect(getDocument().nodes[childId]).toBeUndefined()
      expect(stateAfterChange.expandedIds.has(childId)).toBe(false)
    })

    store.undo()
    expect(getDocument().nodes[profileNode.id].type).toBe('object')
    childIds.forEach((childId) => {
      expect(getDocument().nodes[childId]).toBeDefined()
    })
  })

  it('converts array to object and initializes empty children', () => {
    const doc = jsonToAst({ items: [1, 2] })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const itemsNode = findNodeByKey(getDocument(), 'items')
    const previousChildren = [...(getDocument().nodes[itemsNode.id].children ?? [])]
    expect(previousChildren).toHaveLength(2)

    store.changeNodeType(itemsNode.id, 'object')
    const changedNode = getDocument().nodes[itemsNode.id]
    expect(changedNode.type).toBe('object')
    expect(changedNode.value).toBeNull()
    expect(changedNode.children).toEqual([])
    previousChildren.forEach((childId) => {
      expect(getDocument().nodes[childId]).toBeUndefined()
    })

    store.undo()
    expect(getDocument().nodes[itemsNode.id].type).toBe('array')
    expect(getDocument().nodes[itemsNode.id].children).toHaveLength(2)
  })

  it('does not create history entry for same-type conversion', () => {
    const doc = jsonToAst({ active: true })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const activeNode = findNodeByKey(getDocument(), 'active')
    const undoCountBefore = useJsonStore.getState().undoStack.length

    store.changeNodeType(activeNode.id, 'boolean')

    const state = useJsonStore.getState()
    expect(state.undoStack).toHaveLength(undoCountBefore)
    expect(getDocument().nodes[activeNode.id].type).toBe('boolean')
    expect(getDocument().nodes[activeNode.id].value).toBe(true)
  })

  it('reorders array items and supports undo/redo', () => {
    const doc = jsonToAst({ items: ['a', 'b', 'c'] })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const itemsNode = findNodeByKey(getDocument(), 'items')
    const originalChildren = [...(getDocument().nodes[itemsNode.id].children ?? [])]
    const movedNodeId = originalChildren[0]
    store.selectNode(movedNodeId)

    store.moveArrayItem(itemsNode.id, 0, 2)
    const reorderedChildren = getDocument().nodes[itemsNode.id].children ?? []
    expect(reorderedChildren).toEqual([originalChildren[1], originalChildren[2], originalChildren[0]])
    expect(useJsonStore.getState().selectedId).toBe(movedNodeId)

    store.undo()
    expect(getDocument().nodes[itemsNode.id].children).toEqual(originalChildren)

    store.redo()
    expect(getDocument().nodes[itemsNode.id].children).toEqual(reorderedChildren)
  })

  it('does not create history entry for no-op reorder', () => {
    const doc = jsonToAst({ items: ['a', 'b'] })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const itemsNode = findNodeByKey(getDocument(), 'items')
    const undoBefore = useJsonStore.getState().undoStack.length
    const childrenBefore = [...(getDocument().nodes[itemsNode.id].children ?? [])]

    store.moveArrayItem(itemsNode.id, 1, 1)

    expect(useJsonStore.getState().undoStack).toHaveLength(undoBefore)
    expect(getDocument().nodes[itemsNode.id].children).toEqual(childrenBefore)
  })

  it('ignores invalid reorder requests', () => {
    const doc = jsonToAst({ profile: { name: 'Alice' }, items: ['x', 'y'] })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const profileNode = findNodeByKey(getDocument(), 'profile')
    const itemsNode = findNodeByKey(getDocument(), 'items')
    const undoBefore = useJsonStore.getState().undoStack.length
    const childrenBefore = [...(getDocument().nodes[itemsNode.id].children ?? [])]

    store.moveArrayItem(profileNode.id, 0, 1)
    store.moveArrayItem(itemsNode.id, -1, 1)
    store.moveArrayItem(itemsNode.id, 0, 99)

    expect(useJsonStore.getState().undoStack).toHaveLength(undoBefore)
    expect(getDocument().nodes[itemsNode.id].children).toEqual(childrenBefore)
  })

  it('falls back to untitled.json when file name is empty', () => {
    const store = useJsonStore.getState()

    store.setCurrentFileName('data.json')
    expect(useJsonStore.getState().currentFileName).toBe('data.json')

    store.setCurrentFileName('')
    expect(useJsonStore.getState().currentFileName).toBe('untitled.json')
  })

  it('marks dirty on edit actions and clears dirty on markSaved', () => {
    const doc = jsonToAst({ title: 'Draft' })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const titleNode = findNodeByKey(getDocument(), 'title')
    expect(useJsonStore.getState().isDirty).toBe(false)

    store.updateNodeValue(titleNode.id, 'Published')
    expect(useJsonStore.getState().isDirty).toBe(true)

    store.markSaved()
    const stateAfterSave = useJsonStore.getState()
    expect(stateAfterSave.isDirty).toBe(false)
    expect(stateAfterSave.lastSavedAt).not.toBeNull()
  })

  it('setDocumentWithMeta supports saved and recovered modes', () => {
    const store = useJsonStore.getState()
    const savedDoc = jsonToAst({ source: 'file' })
    const recoveredDoc = jsonToAst({ source: 'autosave' })

    store.setDocumentWithMeta(savedDoc, 'loaded.json', true)
    let state = useJsonStore.getState()
    expect(state.currentFileName).toBe('loaded.json')
    expect(state.isDirty).toBe(false)
    expect(state.lastSavedAt).not.toBeNull()

    store.setDocumentWithMeta(recoveredDoc, 'recovered.json', false)
    state = useJsonStore.getState()
    expect(state.currentFileName).toBe('recovered.json')
    expect(state.isDirty).toBe(true)
  })

  it('builds and resolves JSONPath for nested object/array nodes', () => {
    const doc = jsonToAst({ user: { tags: ['alpha', 'beta'] } })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const tagsNode = findNodeByKey(getDocument(), 'tags')
    const firstTagNodeId = getDocument().nodes[tagsNode.id].children?.[0]
    if (!firstTagNodeId) throw new Error('First tag node is missing')

    const path = store.buildJsonPath(firstTagNodeId)
    expect(path).toBe('$.user.tags[0]')
    expect(store.resolvePathToNodeId(path)).toBe(firstTagNodeId)
  })

  it('supports bracket JSONPath for non-identifier object keys', () => {
    const doc = jsonToAst({ 'user-data': { value: 1 } })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const valueNode = findNodeByKey(getDocument(), 'value')
    const path = store.buildJsonPath(valueNode.id)

    expect(path).toBe("$['user-data'].value")
    expect(store.resolvePathToNodeId(path)).toBe(valueNode.id)
  })

  it('goToJsonPath selects node and expands its ancestors', () => {
    const doc = jsonToAst({ root: { child: { leaf: true } } })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const leafNode = findNodeByKey(getDocument(), 'leaf')
    const result = store.goToJsonPath('$.root.child.leaf')

    expect(result.ok).toBe(true)
    const state = useJsonStore.getState()
    expect(state.selectedId).toBe(leafNode.id)
    expect(state.expandedIds.has(doc.rootId)).toBe(true)
  })

  it('returns failure for invalid JSONPath input', () => {
    const doc = jsonToAst({ a: 1 })
    useJsonStore.getState().setDocument(doc)

    const store = useJsonStore.getState()
    const result = store.goToJsonPath('$.missing.key')

    expect(result.ok).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('updates schema validation settings and errors in store', () => {
    const store = useJsonStore.getState()

    store.setSchemaText('{"type":"object"}')
    store.setSchemaValidationEnabled(false)
    store.setBlockSaveOnSchemaError(true)
    store.setSchemaErrors([{ path: '$.name', keyword: 'required', message: 'must have required property' }])

    const state = useJsonStore.getState()
    expect(state.schemaText).toBe('{"type":"object"}')
    expect(state.schemaValidationEnabled).toBe(false)
    expect(state.blockSaveOnSchemaError).toBe(true)
    expect(state.schemaErrors).toHaveLength(1)
  })

  it('toggles theme between light and dark', () => {
    const store = useJsonStore.getState()
    expect(useJsonStore.getState().theme).toBe('light')

    store.toggleTheme()
    expect(useJsonStore.getState().theme).toBe('dark')

    store.toggleTheme()
    expect(useJsonStore.getState().theme).toBe('light')
  })

  it('sets explicit theme value', () => {
    const store = useJsonStore.getState()

    store.setTheme('dark')
    expect(useJsonStore.getState().theme).toBe('dark')

    store.setTheme('light')
    expect(useJsonStore.getState().theme).toBe('light')
  })
})
