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

  it('falls back to untitled.json when file name is empty', () => {
    const store = useJsonStore.getState()

    store.setCurrentFileName('data.json')
    expect(useJsonStore.getState().currentFileName).toBe('data.json')

    store.setCurrentFileName('')
    expect(useJsonStore.getState().currentFileName).toBe('untitled.json')
  })
})
