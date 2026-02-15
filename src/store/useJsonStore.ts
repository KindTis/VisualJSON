import { create } from 'zustand';
import type { JsonDocument, JsonNode, JsonNodeType } from '../types';
import { v4 as uuidv4 } from 'uuid';

type JsonPrimitive = string | number | boolean | null;

const cloneNode = (node: JsonNode): JsonNode => ({
    ...node,
    children: node.children ? [...node.children] : undefined
});

const getDefaultNodeState = (type: JsonNodeType): Pick<JsonNode, 'value' | 'children'> => {
    if (type === 'string') return { value: '', children: undefined };
    if (type === 'number') return { value: 0, children: undefined };
    if (type === 'boolean') return { value: false, children: undefined };
    if (type === 'null') return { value: null, children: undefined };
    return { value: null, children: [] };
};

type HistoryCommand =
    | { type: 'UPDATE_VALUE'; payload: { id: string; oldValue: JsonPrimitive; newValue: JsonPrimitive } }
    | { type: 'RENAME_KEY'; payload: { id: string; oldKey?: string; newKey: string } }
    | { type: 'ADD_NODE'; payload: { parentId: string; node: JsonNode } }
    | { type: 'DELETE_NODE'; payload: { parentId: string; index: number; node: JsonNode; subtree: Record<string, JsonNode> } }
    | { type: 'CHANGE_TYPE'; payload: { id: string; oldNode: JsonNode; newNode: JsonNode; removedSubtree: Record<string, JsonNode> } };

interface JsonState {
    document: JsonDocument | null;
    currentFileName: string;
    selectedId: string | null;
    expandedIds: Set<string>;

    // Search
    searchQuery: string;
    searchResults: string[];
    currentSearchIndex: number;

    // History
    undoStack: HistoryCommand[];
    redoStack: HistoryCommand[];

    setCurrentFileName: (fileName: string) => void;

    setDocument: (doc: JsonDocument) => void;
    selectNode: (id: string | null) => void;
    toggleExpand: (id: string, expanded?: boolean) => void;

    setSearchQuery: (query: string) => void;
    nextSearchResult: () => void;
    prevSearchResult: () => void;

    undo: () => void;
    redo: () => void;

    // Mutations
    updateNodeValue: (id: string, value: JsonPrimitive) => void;
    changeNodeType: (id: string, nextType: JsonNodeType) => void;
    addNode: (parentId: string, type: JsonNodeType, key?: string) => void;
    deleteNode: (id: string) => void;
    renameNodeKey: (id: string, newKey: string) => void;
}

export const useJsonStore = create<JsonState>((set, get) => ({
    document: null,
    currentFileName: 'untitled.json',
    selectedId: null,
    expandedIds: new Set(),

    searchQuery: '',
    searchResults: [],
    currentSearchIndex: -1,

    undoStack: [],
    redoStack: [],

    setCurrentFileName: (fileName) => set({ currentFileName: fileName || 'untitled.json' }),

    setDocument: (doc) => set({
        document: doc,
        expandedIds: new Set([doc.rootId]),
        selectedId: null,
        undoStack: [],
        redoStack: [],
        searchResults: [],
        searchQuery: '',
        currentSearchIndex: -1
    }),

    selectNode: (id) => set({ selectedId: id }),

    toggleExpand: (id, expanded) => set((state) => {
        const newExpanded = new Set(state.expandedIds);
        if (expanded === undefined) {
            if (newExpanded.has(id)) newExpanded.delete(id);
            else newExpanded.add(id);
        } else {
            if (expanded) newExpanded.add(id);
            else newExpanded.delete(id);
        }
        return { expandedIds: newExpanded };
    }),

    setSearchQuery: (query) => {
        const state = get();
        if (!state.document || !query.trim()) {
            set({ searchQuery: query, searchResults: [], currentSearchIndex: -1 });
            return;
        }

        const results: string[] = [];
        const lowerQuery = query.toLowerCase();

        const traverse = (id: string) => {
            const node = state.document!.nodes[id];
            if (!node) return;

            let match = false;
            if (node.key && node.key.toLowerCase().includes(lowerQuery)) match = true;
            if (node.value !== null && String(node.value).toLowerCase().includes(lowerQuery)) match = true;

            if (match) results.push(id);

            if (node.children) node.children.forEach(traverse);
        };

        traverse(state.document.rootId);

        // Auto expand for first result
        const toExpand = new Set(state.expandedIds);
        if (results.length > 0) {
            const firstId = results[0];
            const nodes = state.document.nodes;
            let curr = nodes[firstId];
            while (curr && curr.parentId) {
                toExpand.add(curr.parentId);
                curr = nodes[curr.parentId];
            }
        }

        set({
            searchQuery: query,
            searchResults: results,
            currentSearchIndex: results.length > 0 ? 0 : -1,
            selectedId: results.length > 0 ? results[0] : state.selectedId,
            expandedIds: toExpand
        });
    },

    nextSearchResult: () => set((state) => {
        if (state.searchResults.length === 0) return {};
        const nextIndex = (state.currentSearchIndex + 1) % state.searchResults.length;
        const nextId = state.searchResults[nextIndex];

        const nodes = state.document!.nodes;
        let curr = nodes[nextId];
        const toExpand = new Set(state.expandedIds);
        while (curr && curr.parentId) {
            toExpand.add(curr.parentId);
            curr = nodes[curr.parentId];
        }

        return {
            currentSearchIndex: nextIndex,
            selectedId: nextId,
            expandedIds: toExpand
        };
    }),

    prevSearchResult: () => set((state) => {
        if (state.searchResults.length === 0) return {};
        const prevIndex = (state.currentSearchIndex - 1 + state.searchResults.length) % state.searchResults.length;
        const prevId = state.searchResults[prevIndex];

        const nodes = state.document!.nodes;
        let curr = nodes[prevId];
        const toExpand = new Set(state.expandedIds);
        while (curr && curr.parentId) {
            toExpand.add(curr.parentId);
            curr = nodes[curr.parentId];
        }

        return {
            currentSearchIndex: prevIndex,
            selectedId: prevId,
            expandedIds: toExpand
        };
    }),

    undo: () => set((state) => {
        if (state.undoStack.length === 0 || !state.document) return {};
        const command = state.undoStack[state.undoStack.length - 1];
        const newUndoStack = state.undoStack.slice(0, -1);
        const newRedoStack = [...state.redoStack, command];

        const newDocument = { ...state.document };
        const nodes = { ...newDocument.nodes };

        if (command.type === 'UPDATE_VALUE') {
            const { id, oldValue } = command.payload;
            if (nodes[id]) nodes[id] = { ...nodes[id], value: oldValue };
        } else if (command.type === 'RENAME_KEY') {
            const { id, oldKey } = command.payload;
            if (nodes[id]) nodes[id] = { ...nodes[id], key: oldKey };
        } else if (command.type === 'ADD_NODE') {
            const { parentId, node } = command.payload;
            const parent = nodes[parentId];
            if (parent && parent.children) {
                nodes[parentId] = {
                    ...parent,
                    children: parent.children.filter(cid => cid !== node.id)
                };
                delete nodes[node.id];
            }
        } else if (command.type === 'DELETE_NODE') {
            const { parentId, index, node, subtree } = command.payload;
            const parent = nodes[parentId];
            if (parent && parent.children) {
                const newChildren = [...parent.children];
                newChildren.splice(index, 0, node.id);
                nodes[parentId] = { ...parent, children: newChildren };
                Object.assign(nodes, subtree);
                nodes[node.id] = node;
            }
        } else if (command.type === 'CHANGE_TYPE') {
            const { id, oldNode, removedSubtree } = command.payload;
            nodes[id] = cloneNode(oldNode);
            Object.entries(removedSubtree).forEach(([nodeId, subtreeNode]) => {
                nodes[nodeId] = cloneNode(subtreeNode);
            });
        }

        return {
            document: { ...newDocument, nodes },
            undoStack: newUndoStack,
            redoStack: newRedoStack
        };
    }),

    redo: () => set((state) => {
        if (state.redoStack.length === 0 || !state.document) return {};
        const command = state.redoStack[state.redoStack.length - 1];
        const newRedoStack = state.redoStack.slice(0, -1);
        const newUndoStack = [...state.undoStack, command];

        const newDocument = { ...state.document };
        const nodes = { ...newDocument.nodes };

        if (command.type === 'UPDATE_VALUE') {
            const { id, newValue } = command.payload;
            if (nodes[id]) nodes[id] = { ...nodes[id], value: newValue };
        } else if (command.type === 'RENAME_KEY') {
            const { id, newKey } = command.payload;
            if (nodes[id]) nodes[id] = { ...nodes[id], key: newKey };
        } else if (command.type === 'ADD_NODE') {
            const { parentId, node } = command.payload;
            const parent = nodes[parentId];
            if (parent && parent.children) {
                nodes[parentId] = { ...parent, children: [...parent.children, node.id] };
                nodes[node.id] = node;
            }
        } else if (command.type === 'DELETE_NODE') {
            const { parentId, node, subtree } = command.payload;
            const parent = nodes[parentId];
            if (parent && parent.children) {
                nodes[parentId] = {
                    ...parent,
                    children: parent.children.filter(cid => cid !== node.id)
                };
                delete nodes[node.id];
                Object.keys(subtree).forEach(id => delete nodes[id]);
            }
        } else if (command.type === 'CHANGE_TYPE') {
            const { id, newNode, removedSubtree } = command.payload;
            nodes[id] = cloneNode(newNode);
            Object.keys(removedSubtree).forEach(nodeId => delete nodes[nodeId]);
        }

        return {
            document: { ...newDocument, nodes },
            undoStack: newUndoStack,
            redoStack: newRedoStack
        };
    }),

    updateNodeValue: (id, value) => set((state) => {
        if (!state.document) return {};
        const node = state.document.nodes[id];
        if (!node) return {};

        const oldValue: JsonPrimitive = (node.value ?? null) as JsonPrimitive;

        const command: HistoryCommand = {
            type: 'UPDATE_VALUE',
            payload: { id, oldValue, newValue: value }
        };

        return {
            document: {
                ...state.document,
                nodes: {
                    ...state.document.nodes,
                    [id]: { ...node, value },
                },
            },
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),

    changeNodeType: (id, nextType) => set((state) => {
        if (!state.document) return {};
        const node = state.document.nodes[id];
        if (!node || node.type === nextType) return {};

        const removedSubtree: Record<string, JsonNode> = {};
        const collectSubtree = (nodeId: string) => {
            const subtreeNode = state.document!.nodes[nodeId];
            if (!subtreeNode) return;
            removedSubtree[nodeId] = cloneNode(subtreeNode);
            if (subtreeNode.children) subtreeNode.children.forEach(collectSubtree);
        };
        if (node.children) node.children.forEach(collectSubtree);

        const oldNode = cloneNode(node);
        const defaultState = getDefaultNodeState(nextType);
        const newNode: JsonNode = {
            ...node,
            type: nextType,
            value: defaultState.value,
            children: defaultState.children
        };

        const newNodes = { ...state.document.nodes, [id]: cloneNode(newNode) };
        Object.keys(removedSubtree).forEach((nodeId) => delete newNodes[nodeId]);

        const command: HistoryCommand = {
            type: 'CHANGE_TYPE',
            payload: {
                id,
                oldNode,
                newNode: cloneNode(newNode),
                removedSubtree
            }
        };

        const newExpandedIds = new Set(state.expandedIds);
        Object.keys(removedSubtree).forEach((nodeId) => newExpandedIds.delete(nodeId));
        if (nextType === 'object' || nextType === 'array') {
            newExpandedIds.add(id);
        }

        return {
            document: { ...state.document, nodes: newNodes },
            expandedIds: newExpandedIds,
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),

    addNode: (parentId, type, key) => set((state) => {
        if (!state.document) return {};
        const parent = state.document.nodes[parentId];
        if (!parent || !parent.children) return {};

        let value: JsonPrimitive = null;
        if (type === 'string') value = "";
        else if (type === 'number') value = 0;
        else if (type === 'boolean') value = false;
        else if (type === 'object' || type === 'array') value = null;

        const newId = uuidv4();
        const newNode: JsonNode = {
            id: newId,
            type,
            parentId,
            key,
            value,
            children: (type === 'object' || type === 'array') ? [] : undefined
        };

        const command: HistoryCommand = {
            type: 'ADD_NODE',
            payload: { parentId, node: newNode }
        };

        const newNodes = { ...state.document.nodes };
        newNodes[newId] = newNode;
        newNodes[parentId] = {
            ...parent,
            children: [...parent.children, newId]
        };

        return {
            document: { ...state.document, nodes: newNodes },
            expandedIds: new Set([...state.expandedIds, parentId]),
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),

    deleteNode: (id) => set((state) => {
        if (!state.document) return {};
        const node = state.document.nodes[id];
        if (!node || !node.parentId) return {};

        const parent = state.document.nodes[node.parentId];
        if (!parent || !parent.children) return {};

        const index = parent.children.indexOf(id);
        if (index === -1) return {};

        const subtree: Record<string, JsonNode> = {};
        const collectSubtree = (nodeId: string) => {
            const n = state.document!.nodes[nodeId];
            if (n && n.children) n.children.forEach(collectSubtree);
            if (id !== nodeId && n) subtree[nodeId] = n;
        };
        if (node.children) node.children.forEach(collectSubtree);

        const command: HistoryCommand = {
            type: 'DELETE_NODE',
            payload: { parentId: node.parentId, index, node, subtree }
        };

        const newChildren = parent.children.filter(childId => childId !== id);
        const newNodes = { ...state.document.nodes };

        const deleteRecursive = (nodeId: string) => {
            const n = newNodes[nodeId];
            if (n && n.children) {
                n.children.forEach(deleteRecursive);
            }
            delete newNodes[nodeId];
        };
        deleteRecursive(id);

        return {
            document: {
                ...state.document,
                nodes: {
                    ...newNodes,
                    [parent.id]: {
                        ...parent,
                        children: newChildren
                    }
                }
            },
            selectedId: state.selectedId === id ? null : state.selectedId,
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),

    renameNodeKey: (id, newKey) => set((state) => {
        if (!state.document) return {};
        const node = state.document.nodes[id];
        if (!node || !node.parentId) return {};

        const command: HistoryCommand = {
            type: 'RENAME_KEY',
            payload: { id, oldKey: node.key, newKey }
        };

        return {
            document: {
                ...state.document,
                nodes: {
                    ...state.document.nodes,
                    [id]: { ...node, key: newKey }
                }
            },
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),
}));
