import { create } from 'zustand';
import type { JsonDocument, JsonNode, JsonNodeType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { astToJson, jsonToAst } from '../utils/parser';
import { applyDiffEntries as applyJsonDiffEntries, type JsonDiffEntry } from '../utils/jsonDiff';

type JsonPrimitive = string | number | boolean | null;
type ThemeMode = 'light' | 'dark';
type JsonPathSegment = { type: 'key'; value: string } | { type: 'index'; value: number };

export type ViewMode = 'tree' | 'card';
export type PasteMode = 'replace' | 'append' | 'insert';

export interface SearchFilters {
    matchKey: boolean;
    matchValue: boolean;
    caseSensitive: boolean;
    regex: boolean;
}

export interface ReplacePreviewEntry {
    id: string;
    field: 'key' | 'value';
    before: string;
    after: string;
}

export interface SchemaValidationError {
    path: string;
    message: string;
    keyword: string;
    nodeId?: string;
}

const cloneNode = (node: JsonNode): JsonNode => ({
    ...node,
    children: node.children ? [...node.children] : undefined
});

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const escapePathKey = (key: string): string => key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const appendKeySegment = (base: string, key: string): string => {
    if (IDENTIFIER_PATTERN.test(key)) return `${base}.${key}`;
    return `${base}['${escapePathKey(key)}']`;
};

const parseJsonPath = (path: string): JsonPathSegment[] | null => {
    const value = path.trim();
    if (!value.startsWith('$')) return null;

    const segments: JsonPathSegment[] = [];
    let index = 1;

    while (index < value.length) {
        const current = value[index];

        if (current === '.') {
            index += 1;
            const start = index;
            while (index < value.length && /[A-Za-z0-9_$]/.test(value[index])) index += 1;
            if (start === index) return null;
            segments.push({ type: 'key', value: value.slice(start, index) });
            continue;
        }

        if (current === '[') {
            index += 1;
            if (index >= value.length) return null;

            if (value[index] === "'") {
                index += 1;
                let key = '';
                while (index < value.length) {
                    const ch = value[index];
                    if (ch === '\\') {
                        const next = value[index + 1];
                        if (next === undefined) return null;
                        key += next;
                        index += 2;
                        continue;
                    }
                    if (ch === "'") break;
                    key += ch;
                    index += 1;
                }
                if (value[index] !== "'") return null;
                index += 1;
                if (value[index] !== ']') return null;
                index += 1;
                segments.push({ type: 'key', value: key });
                continue;
            }

            const start = index;
            while (index < value.length && /[0-9]/.test(value[index])) index += 1;
            if (start === index || value[index] !== ']') return null;
            segments.push({ type: 'index', value: Number(value.slice(start, index)) });
            index += 1;
            continue;
        }

        return null;
    }

    return segments;
};

const buildPathInDocument = (doc: JsonDocument, nodeId: string): string => {
    const nodes = doc.nodes;
    let current = nodes[nodeId];
    if (!current) return '$';

    const parts: string[] = [];
    while (current.parentId) {
        const parent = nodes[current.parentId];
        if (!parent) return '$';

        if (parent.type === 'array') {
            const index = parent.children?.indexOf(current.id) ?? -1;
            if (index < 0) return '$';
            parts.push(`[${index}]`);
        } else if (parent.type === 'object') {
            if (current.key === undefined) return '$';
            parts.push(appendKeySegment('', current.key));
        } else {
            return '$';
        }
        current = parent;
    }

    return `$${parts.reverse().join('')}`;
};

const resolvePathInDocument = (doc: JsonDocument, jsonPath: string): string | null => {
    const segments = parseJsonPath(jsonPath);
    if (!segments) return null;

    let currentId = doc.rootId;
    for (const segment of segments) {
        const current = doc.nodes[currentId];
        if (!current) return null;

        if (segment.type === 'key') {
            if (current.type !== 'object' || !current.children) return null;
            const nextId = current.children.find((childId) => doc.nodes[childId]?.key === segment.value);
            if (!nextId) return null;
            currentId = nextId;
        } else {
            if (current.type !== 'array' || !current.children) return null;
            if (segment.value < 0 || segment.value >= current.children.length) return null;
            currentId = current.children[segment.value];
        }
    }

    return currentId;
};

const moveListItem = (list: string[], fromIndex: number, toIndex: number): string[] => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length || fromIndex === toIndex) {
        return list;
    }
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};

const collectDescendantIds = (nodes: Record<string, JsonNode>, rootId: string): Set<string> => {
    const ids = new Set<string>();
    const walk = (nodeId: string) => {
        const node = nodes[nodeId];
        if (!node) return;
        (node.children ?? []).forEach((childId) => {
            ids.add(childId);
            walk(childId);
        });
    };
    walk(rootId);
    return ids;
};

const getDefaultNodeState = (type: JsonNodeType): Pick<JsonNode, 'value' | 'children'> => {
    if (type === 'string') return { value: '', children: undefined };
    if (type === 'number') return { value: 0, children: undefined };
    if (type === 'boolean') return { value: false, children: undefined };
    if (type === 'null') return { value: null, children: undefined };
    return { value: null, children: [] };
};

const cloneDocument = (doc: JsonDocument): JsonDocument => ({
    rootId: doc.rootId,
    nodes: Object.fromEntries(
        Object.entries(doc.nodes).map(([id, node]) => [id, cloneNode(node)])
    )
});

const DEFAULT_SEARCH_FILTERS: SearchFilters = {
    matchKey: true,
    matchValue: true,
    caseSensitive: false,
    regex: false
};

const ensureUniqueObjectKey = (
    nodes: Record<string, JsonNode>,
    parentId: string,
    desiredKey: string,
    exceptId?: string
): string => {
    const parent = nodes[parentId];
    if (!parent || parent.type !== 'object' || !parent.children) return desiredKey || 'key';

    const base = (desiredKey || 'key').trim() || 'key';
    const existing = new Set(
        parent.children
            .filter((childId) => childId !== exceptId)
            .map((childId) => nodes[childId]?.key)
            .filter((value): value is string => typeof value === 'string')
    );

    if (!existing.has(base)) return base;

    let suffix = 1;
    while (existing.has(`${base}_${suffix}`)) suffix += 1;
    return `${base}_${suffix}`;
};

const nodeToJson = (nodes: Record<string, JsonNode>, nodeId: string): unknown => {
    const node = nodes[nodeId];
    if (!node) return null;

    if (node.type === 'object') {
        const value: Record<string, unknown> = {};
        (node.children ?? []).forEach((childId) => {
            const child = nodes[childId];
            if (!child || child.key === undefined) return;
            value[child.key] = nodeToJson(nodes, childId);
        });
        return value;
    }

    if (node.type === 'array') {
        return (node.children ?? []).map((childId) => nodeToJson(nodes, childId));
    }

    return node.value ?? null;
};

const buildSubtreeFromValue = (
    value: unknown,
    parentId?: string,
    key?: string,
    rootIdOverride?: string
): { rootId: string; nodes: Record<string, JsonNode> } => {
    const nodes: Record<string, JsonNode> = {};

    const walk = (currentValue: unknown, currentParent?: string, currentKey?: string, overrideId?: string): string => {
        const id = overrideId ?? uuidv4();

        if (currentValue === null) {
            nodes[id] = { id, parentId: currentParent, key: currentKey, type: 'null', value: null };
            return id;
        }

        if (Array.isArray(currentValue)) {
            const children = currentValue.map((item) => walk(item, id));
            nodes[id] = { id, parentId: currentParent, key: currentKey, type: 'array', value: null, children };
            return id;
        }

        if (typeof currentValue === 'object') {
            const children = Object.entries(currentValue as Record<string, unknown>).map(([childKey, childValue]) => (
                walk(childValue, id, childKey)
            ));
            nodes[id] = { id, parentId: currentParent, key: currentKey, type: 'object', value: null, children };
            return id;
        }

        nodes[id] = {
            id,
            parentId: currentParent,
            key: currentKey,
            type: typeof currentValue as JsonNodeType,
            value: currentValue as JsonPrimitive,
            children: undefined
        };
        return id;
    };

    const rootId = walk(value, parentId, key, rootIdOverride);
    return { rootId, nodes };
};

const sortJsonKeysDeep = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortJsonKeysDeep);
    if (!value || typeof value !== 'object') return value;

    return Object.keys(value as Record<string, unknown>)
        .sort((left, right) => left.localeCompare(right))
        .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = sortJsonKeysDeep((value as Record<string, unknown>)[key]);
            return acc;
        }, {});
};

const toSearchRegex = (query: string, filters: SearchFilters): RegExp | null => {
    if (!query) return null;
    try {
        if (filters.regex) {
            return new RegExp(query, filters.caseSensitive ? 'g' : 'gi');
        }
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, filters.caseSensitive ? 'g' : 'gi');
    } catch {
        return null;
    }
};

type HistoryCommand =
    | { type: 'UPDATE_VALUE'; payload: { id: string; oldValue: JsonPrimitive; newValue: JsonPrimitive } }
    | { type: 'RENAME_KEY'; payload: { id: string; oldKey?: string; newKey: string } }
    | { type: 'ADD_NODE'; payload: { parentId: string; node: JsonNode } }
    | { type: 'DELETE_NODE'; payload: { parentId: string; index: number; node: JsonNode; subtree: Record<string, JsonNode> } }
    | { type: 'MOVE_ARRAY_ITEM'; payload: { parentId: string; fromIndex: number; toIndex: number } }
    | { type: 'CHANGE_TYPE'; payload: { id: string; oldNode: JsonNode; newNode: JsonNode; removedSubtree: Record<string, JsonNode> } }
    | {
        type: 'REPLACE_DOCUMENT';
        payload: {
            before: JsonDocument;
            after: JsonDocument;
            beforeSelectedId: string | null;
            afterSelectedId: string | null;
            beforeExpandedIds: string[];
            afterExpandedIds: string[];
        };
    };

interface JsonState {
    document: JsonDocument | null;
    currentFileName: string;
    theme: ThemeMode;
    viewMode: ViewMode;
    isDirty: boolean;
    lastSavedAt: number | null;
    schemaText: string;
    schemaValidationEnabled: boolean;
    blockSaveOnSchemaError: boolean;
    schemaErrors: SchemaValidationError[];
    selectedId: string | null;
    expandedIds: Set<string>;
    focusRootId: string | null;
    multiSelectedIds: Set<string>;
    bookmarks: string[];

    // Search
    searchQuery: string;
    searchFilters: SearchFilters;
    searchResults: string[];
    currentSearchIndex: number;
    replaceTextValue: string;
    replacePreview: ReplacePreviewEntry[];

    // History
    undoStack: HistoryCommand[];
    redoStack: HistoryCommand[];

    setCurrentFileName: (fileName: string) => void;
    setTheme: (theme: ThemeMode) => void;
    toggleTheme: () => void;
    setViewMode: (mode: ViewMode) => void;
    toggleViewMode: () => void;
    markDirty: () => void;
    markSaved: () => void;
    setSchemaText: (schemaText: string) => void;
    setSchemaValidationEnabled: (enabled: boolean) => void;
    setBlockSaveOnSchemaError: (enabled: boolean) => void;
    setSchemaErrors: (errors: SchemaValidationError[]) => void;

    setDocument: (doc: JsonDocument) => void;
    setDocumentWithMeta: (doc: JsonDocument, fileName?: string, markAsSaved?: boolean) => void;
    replaceDocumentFromJson: (jsonValue: unknown) => void;
    buildJsonPath: (nodeId: string) => string;
    resolvePathToNodeId: (jsonPath: string) => string | null;
    goToJsonPath: (jsonPath: string) => { ok: boolean; reason?: string };
    focusNodeWithAncestors: (nodeId: string) => void;
    selectNode: (id: string | null) => void;
    toggleExpand: (id: string, expanded?: boolean) => void;
    toggleFocusMode: (nodeId?: string) => void;
    clearFocusMode: () => void;
    toggleMultiSelect: (nodeId: string) => void;
    clearMultiSelect: () => void;
    batchDeleteSelected: () => void;
    addBookmark: (path: string) => void;
    removeBookmark: (path: string) => void;
    addCurrentPathBookmark: () => void;
    jumpBookmark: (path: string) => { ok: boolean; reason?: string };

    setSearchQuery: (query: string) => void;
    setSearchFilters: (filters: Partial<SearchFilters>) => void;
    nextSearchResult: () => void;
    prevSearchResult: () => void;
    setReplaceTextValue: (value: string) => void;
    buildReplacePreview: () => void;
    applyReplacePreview: () => void;

    undo: () => void;
    redo: () => void;

    // Mutations
    updateNodeValue: (id: string, value: JsonPrimitive) => void;
    changeNodeType: (id: string, nextType: JsonNodeType) => void;
    moveArrayItem: (parentId: string, fromIndex: number, toIndex: number) => void;
    addNode: (parentId: string, type: JsonNodeType, key?: string) => void;
    deleteNode: (id: string) => void;
    renameNodeKey: (id: string, newKey: string) => void;
    copyNodeJson: (nodeId: string) => string | null;
    pasteNodeJson: (targetId: string, rawJson: string, mode: PasteMode) => { ok: boolean; reason?: string };
    sortObjectKeys: (nodeId: string, direction?: 'asc' | 'desc') => void;
    formatDocument: (mode: 'pretty' | 'minify' | 'sort') => void;
    applyDiffSelection: (entries: JsonDiffEntry[]) => void;
}

export const useJsonStore = create<JsonState>((set, get) => ({
    document: null,
    currentFileName: 'untitled.json',
    theme: 'light',
    viewMode: 'tree',
    isDirty: false,
    lastSavedAt: null,
    schemaText: '',
    schemaValidationEnabled: true,
    blockSaveOnSchemaError: false,
    schemaErrors: [],
    selectedId: null,
    expandedIds: new Set(),
    focusRootId: null,
    multiSelectedIds: new Set(),
    bookmarks: [],

    searchQuery: '',
    searchFilters: DEFAULT_SEARCH_FILTERS,
    searchResults: [],
    currentSearchIndex: -1,
    replaceTextValue: '',
    replacePreview: [],

    undoStack: [],
    redoStack: [],

    setCurrentFileName: (fileName) => set({ currentFileName: fileName || 'untitled.json' }),
    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    setViewMode: (mode) => set({ viewMode: mode }),
    toggleViewMode: () => set((state) => ({ viewMode: state.viewMode === 'tree' ? 'card' : 'tree' })),
    markDirty: () => set({ isDirty: true }),
    markSaved: () => set({ isDirty: false, lastSavedAt: Date.now() }),
    setSchemaText: (schemaText) => set({ schemaText }),
    setSchemaValidationEnabled: (enabled) => set({ schemaValidationEnabled: enabled }),
    setBlockSaveOnSchemaError: (enabled) => set({ blockSaveOnSchemaError: enabled }),
    setSchemaErrors: (errors) => set({ schemaErrors: errors }),

    setDocument: (doc) => set((state) => ({
        document: doc,
        currentFileName: state.currentFileName || 'untitled.json',
        expandedIds: new Set([doc.rootId]),
        selectedId: null,
        focusRootId: null,
        multiSelectedIds: new Set(),
        undoStack: [],
        redoStack: [],
        searchResults: [],
        searchQuery: '',
        currentSearchIndex: -1,
        replacePreview: [],
        isDirty: false,
        lastSavedAt: Date.now()
    })),

    setDocumentWithMeta: (doc, fileName, markAsSaved = true) => set((state) => ({
        document: doc,
        currentFileName: fileName || state.currentFileName || 'untitled.json',
        expandedIds: new Set([doc.rootId]),
        selectedId: null,
        focusRootId: null,
        multiSelectedIds: new Set(),
        undoStack: [],
        redoStack: [],
        searchResults: [],
        searchQuery: '',
        currentSearchIndex: -1,
        replacePreview: [],
        isDirty: !markAsSaved,
        lastSavedAt: markAsSaved ? Date.now() : state.lastSavedAt
    })),

    replaceDocumentFromJson: (jsonValue) => set((state) => {
        if (!state.document) return {};

        const beforeDoc = cloneDocument(state.document);
        const beforeSelectedId = state.selectedId;
        const beforeExpandedIds = [...state.expandedIds];

        const selectedPath = state.selectedId ? buildPathInDocument(state.document, state.selectedId) : null;
        const nextDoc = jsonToAst(jsonValue as Parameters<typeof jsonToAst>[0]);
        const nextSelectedId = selectedPath ? resolvePathInDocument(nextDoc, selectedPath) : null;

        const nextExpandedIds = new Set<string>([nextDoc.rootId]);
        if (nextSelectedId) {
            let current = nextDoc.nodes[nextSelectedId];
            while (current && current.parentId) {
                nextExpandedIds.add(current.parentId);
                current = nextDoc.nodes[current.parentId];
            }
        }

        const command: HistoryCommand = {
            type: 'REPLACE_DOCUMENT',
            payload: {
                before: beforeDoc,
                after: cloneDocument(nextDoc),
                beforeSelectedId,
                afterSelectedId: nextSelectedId,
                beforeExpandedIds,
                afterExpandedIds: [...nextExpandedIds]
            }
        };

        return {
            document: nextDoc,
            selectedId: nextSelectedId,
            expandedIds: nextExpandedIds,
            focusRootId: null,
            multiSelectedIds: new Set(),
            isDirty: true,
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),

    buildJsonPath: (nodeId) => {
        const state = get();
        if (!state.document) return '$';

        const nodes = state.document.nodes;
        let current = nodes[nodeId];
        if (!current) return '$';

        const parts: string[] = [];
        while (current.parentId) {
            const parent = nodes[current.parentId];
            if (!parent) return '$';

            if (parent.type === 'array') {
                const index = parent.children?.indexOf(current.id) ?? -1;
                if (index < 0) return '$';
                parts.push(`[${index}]`);
            } else if (parent.type === 'object') {
                if (current.key === undefined) return '$';
                parts.push(appendKeySegment('', current.key));
            } else {
                return '$';
            }

            current = parent;
        }

        return `$${parts.reverse().join('')}`;
    },

    resolvePathToNodeId: (jsonPath) => {
        const state = get();
        if (!state.document) return null;

        const segments = parseJsonPath(jsonPath);
        if (!segments) return null;

        const nodes = state.document.nodes;
        let currentId = state.document.rootId;

        for (const segment of segments) {
            const current = nodes[currentId];
            if (!current) return null;

            if (segment.type === 'key') {
                if (current.type !== 'object' || !current.children) return null;
                const nextId = current.children.find((childId) => nodes[childId]?.key === segment.value);
                if (!nextId) return null;
                currentId = nextId;
            } else {
                if (current.type !== 'array' || !current.children) return null;
                if (segment.value < 0 || segment.value >= current.children.length) return null;
                currentId = current.children[segment.value];
            }
        }

        return currentId;
    },

    goToJsonPath: (jsonPath) => {
        const state = get();
        const nodeId = state.resolvePathToNodeId(jsonPath);
        if (!nodeId) return { ok: false, reason: 'Invalid or unresolved JSONPath' };
        state.focusNodeWithAncestors(nodeId);
        return { ok: true };
    },

    focusNodeWithAncestors: (nodeId) => set((state) => {
        if (!state.document || !state.document.nodes[nodeId]) return {};

        const expanded = new Set(state.expandedIds);
        const nodes = state.document.nodes;
        let current = nodes[nodeId];
        while (current && current.parentId) {
            expanded.add(current.parentId);
            current = nodes[current.parentId];
        }

        return {
            selectedId: nodeId,
            expandedIds: expanded
        };
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

    toggleFocusMode: (nodeId) => set((state) => {
        const targetId = nodeId || state.selectedId;
        if (!targetId || !state.document || !state.document.nodes[targetId]) return {};
        if (state.focusRootId === targetId) return { focusRootId: null };
        return { focusRootId: targetId, expandedIds: new Set([targetId]) };
    }),

    clearFocusMode: () => set({ focusRootId: null }),

    toggleMultiSelect: (nodeId) => set((state) => {
        if (!state.document || !state.document.nodes[nodeId]) return {};
        const next = new Set(state.multiSelectedIds);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return { multiSelectedIds: next, selectedId: nodeId };
    }),

    clearMultiSelect: () => set({ multiSelectedIds: new Set() }),

    batchDeleteSelected: () => set((state) => {
        if (!state.document || state.multiSelectedIds.size === 0) return {};

        const nodes = { ...state.document.nodes };
        const selected = [...state.multiSelectedIds].filter((id) => nodes[id] && nodes[id].parentId);
        const selectedSet = new Set(selected);

        const topLevel = selected.filter((id) => {
            let current = nodes[id];
            while (current && current.parentId) {
                if (selectedSet.has(current.parentId)) return false;
                current = nodes[current.parentId];
            }
            return true;
        });

        if (topLevel.length === 0) {
            return { multiSelectedIds: new Set() };
        }

        const beforeDoc = cloneDocument(state.document);
        const beforeSelectedId = state.selectedId;
        const beforeExpandedIds = [...state.expandedIds];
        const deletedIds = new Set<string>();

        topLevel.forEach((nodeId) => {
            const node = nodes[nodeId];
            if (!node || !node.parentId) return;
            const parent = nodes[node.parentId];
            if (!parent || !parent.children) return;

            nodes[parent.id] = {
                ...parent,
                children: parent.children.filter((childId) => childId !== nodeId)
            };

            const deleteRecursive = (id: string) => {
                const item = nodes[id];
                if (!item) return;
                (item.children ?? []).forEach(deleteRecursive);
                deletedIds.add(id);
                delete nodes[id];
            };
            deleteRecursive(nodeId);
        });

        const nextDoc: JsonDocument = {
            rootId: state.document.rootId,
            nodes
        };
        const nextSelectedId = state.selectedId && !deletedIds.has(state.selectedId) ? state.selectedId : null;
        const nextExpandedIds = new Set<string>([state.document.rootId]);
        [...state.expandedIds].forEach((id) => {
            if (!deletedIds.has(id) && nodes[id]) nextExpandedIds.add(id);
        });

        const command: HistoryCommand = {
            type: 'REPLACE_DOCUMENT',
            payload: {
                before: beforeDoc,
                after: cloneDocument(nextDoc),
                beforeSelectedId,
                afterSelectedId: nextSelectedId,
                beforeExpandedIds,
                afterExpandedIds: [...nextExpandedIds]
            }
        };

        return {
            document: nextDoc,
            selectedId: nextSelectedId,
            expandedIds: nextExpandedIds,
            multiSelectedIds: new Set(),
            focusRootId: null,
            isDirty: true,
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),

    addBookmark: (path) => set((state) => {
        const normalized = path.trim();
        if (!normalized || state.bookmarks.includes(normalized)) return {};
        return { bookmarks: [...state.bookmarks, normalized] };
    }),

    removeBookmark: (path) => set((state) => ({
        bookmarks: state.bookmarks.filter((item) => item !== path)
    })),

    addCurrentPathBookmark: () => {
        const state = get();
        if (!state.document || !state.selectedId) return;
        state.addBookmark(state.buildJsonPath(state.selectedId));
    },

    jumpBookmark: (path) => get().goToJsonPath(path),

    setSearchQuery: (query) => {
        const state = get();
        if (!state.document || !query.trim()) {
            set({ searchQuery: query, searchResults: [], currentSearchIndex: -1, replacePreview: [] });
            return;
        }

        const filters = state.searchFilters;
        const regex = toSearchRegex(query, filters);
        const results: string[] = [];

        const matches = (text: string): boolean => {
            if (filters.regex) {
                if (!regex) return false;
                regex.lastIndex = 0;
                return regex.test(text);
            }
            return filters.caseSensitive
                ? text.includes(query)
                : text.toLowerCase().includes(query.toLowerCase());
        };

        const traverse = (id: string) => {
            const node = state.document!.nodes[id];
            if (!node) return;

            let match = false;
            if (filters.matchKey && node.key && matches(node.key)) match = true;
            if (!match && filters.matchValue && node.value !== null && node.value !== undefined) {
                match = matches(String(node.value));
            }

            if (match) results.push(id);
            if (node.children) node.children.forEach(traverse);
        };

        traverse(state.document.rootId);

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
            expandedIds: toExpand,
            replacePreview: []
        });
    },

    setSearchFilters: (filters) => {
        const state = get();
        const nextFilters = { ...state.searchFilters, ...filters };
        set({ searchFilters: nextFilters });
        if (state.searchQuery.trim()) {
            get().setSearchQuery(state.searchQuery);
        }
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

    setReplaceTextValue: (value) => set({ replaceTextValue: value }),

    buildReplacePreview: () => set((state) => {
        if (!state.document || !state.searchQuery.trim()) return { replacePreview: [] };

        const regex = toSearchRegex(state.searchQuery, state.searchFilters);
        if (!regex) return { replacePreview: [] };

        const preview: ReplacePreviewEntry[] = [];
        state.searchResults.forEach((id) => {
            const node = state.document!.nodes[id];
            if (!node) return;

            if (state.searchFilters.matchKey && node.key !== undefined) {
                regex.lastIndex = 0;
                const nextKey = node.key.replace(regex, state.replaceTextValue);
                if (nextKey !== node.key) {
                    preview.push({ id, field: 'key', before: node.key, after: nextKey });
                }
            }

            if (state.searchFilters.matchValue && node.type === 'string' && typeof node.value === 'string') {
                regex.lastIndex = 0;
                const nextValue = node.value.replace(regex, state.replaceTextValue);
                if (nextValue !== node.value) {
                    preview.push({ id, field: 'value', before: node.value, after: nextValue });
                }
            }
        });

        return { replacePreview: preview };
    }),

    applyReplacePreview: () => set((state) => {
        if (!state.document || state.replacePreview.length === 0) return {};

        const beforeDoc = cloneDocument(state.document);
        const beforeSelectedId = state.selectedId;
        const beforeExpandedIds = [...state.expandedIds];

        const newNodes = { ...state.document.nodes };

        state.replacePreview.forEach((entry) => {
            const node = newNodes[entry.id];
            if (!node) return;

            if (entry.field === 'key' && node.parentId) {
                const key = ensureUniqueObjectKey(newNodes, node.parentId, entry.after, node.id);
                newNodes[entry.id] = { ...node, key };
                return;
            }

            if (entry.field === 'value' && node.type === 'string') {
                newNodes[entry.id] = { ...node, value: entry.after };
            }
        });

        const afterDoc: JsonDocument = {
            rootId: state.document.rootId,
            nodes: newNodes
        };

        const command: HistoryCommand = {
            type: 'REPLACE_DOCUMENT',
            payload: {
                before: beforeDoc,
                after: cloneDocument(afterDoc),
                beforeSelectedId,
                afterSelectedId: state.selectedId,
                beforeExpandedIds,
                afterExpandedIds: [...state.expandedIds]
            }
        };

        return {
            document: afterDoc,
            replacePreview: [],
            isDirty: true,
            undoStack: [...state.undoStack, command],
            redoStack: []
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
        } else if (command.type === 'MOVE_ARRAY_ITEM') {
            const { parentId, fromIndex, toIndex } = command.payload;
            const parent = nodes[parentId];
            if (parent && parent.type === 'array' && parent.children) {
                const reverted = moveListItem(parent.children, toIndex, fromIndex);
                if (reverted !== parent.children) {
                    nodes[parentId] = { ...parent, children: reverted };
                }
            }
        } else if (command.type === 'CHANGE_TYPE') {
            const { id, oldNode, removedSubtree } = command.payload;
            nodes[id] = cloneNode(oldNode);
            Object.entries(removedSubtree).forEach(([nodeId, subtreeNode]) => {
                nodes[nodeId] = cloneNode(subtreeNode);
            });
        } else if (command.type === 'REPLACE_DOCUMENT') {
            return {
                document: cloneDocument(command.payload.before),
                selectedId: command.payload.beforeSelectedId,
                expandedIds: new Set(command.payload.beforeExpandedIds),
                focusRootId: null,
                multiSelectedIds: new Set(),
                isDirty: true,
                undoStack: newUndoStack,
                redoStack: newRedoStack
            };
        }

        return {
            document: { ...newDocument, nodes },
            isDirty: true,
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
        } else if (command.type === 'MOVE_ARRAY_ITEM') {
            const { parentId, fromIndex, toIndex } = command.payload;
            const parent = nodes[parentId];
            if (parent && parent.type === 'array' && parent.children) {
                const reordered = moveListItem(parent.children, fromIndex, toIndex);
                if (reordered !== parent.children) {
                    nodes[parentId] = { ...parent, children: reordered };
                }
            }
        } else if (command.type === 'CHANGE_TYPE') {
            const { id, newNode, removedSubtree } = command.payload;
            nodes[id] = cloneNode(newNode);
            Object.keys(removedSubtree).forEach(nodeId => delete nodes[nodeId]);
        } else if (command.type === 'REPLACE_DOCUMENT') {
            return {
                document: cloneDocument(command.payload.after),
                selectedId: command.payload.afterSelectedId,
                expandedIds: new Set(command.payload.afterExpandedIds),
                focusRootId: null,
                multiSelectedIds: new Set(),
                isDirty: true,
                undoStack: newUndoStack,
                redoStack: newRedoStack
            };
        }

        return {
            document: { ...newDocument, nodes },
            isDirty: true,
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
            isDirty: true,
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
            isDirty: true,
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),

    moveArrayItem: (parentId, fromIndex, toIndex) => set((state) => {
        if (!state.document) return {};

        const parent = state.document.nodes[parentId];
        if (!parent || parent.type !== 'array' || !parent.children) return {};

        const reordered = moveListItem(parent.children, fromIndex, toIndex);
        if (reordered === parent.children) return {};

        const command: HistoryCommand = {
            type: 'MOVE_ARRAY_ITEM',
            payload: { parentId, fromIndex, toIndex }
        };

        return {
            document: {
                ...state.document,
                nodes: {
                    ...state.document.nodes,
                    [parentId]: {
                        ...parent,
                        children: reordered
                    }
                }
            },
            isDirty: true,
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
        const resolvedKey = parent.type === 'object'
            ? ensureUniqueObjectKey(state.document.nodes, parentId, key || 'key')
            : key;
        const newNode: JsonNode = {
            id: newId,
            type,
            parentId,
            key: resolvedKey,
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
            isDirty: true,
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
            isDirty: true,
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),

    renameNodeKey: (id, newKey) => set((state) => {
        if (!state.document) return {};
        const node = state.document.nodes[id];
        if (!node || !node.parentId) return {};
        const uniqueKey = ensureUniqueObjectKey(state.document.nodes, node.parentId, newKey, id);

        const command: HistoryCommand = {
            type: 'RENAME_KEY',
            payload: { id, oldKey: node.key, newKey: uniqueKey }
        };

        return {
            document: {
                ...state.document,
                nodes: {
                    ...state.document.nodes,
                    [id]: { ...node, key: uniqueKey }
                }
            },
            isDirty: true,
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),

    copyNodeJson: (nodeId) => {
        const state = get();
        if (!state.document || !state.document.nodes[nodeId]) return null;
        return JSON.stringify(nodeToJson(state.document.nodes, nodeId), null, 2);
    },

    pasteNodeJson: (targetId, rawJson, mode) => {
        const state = get();
        if (!state.document || !state.document.nodes[targetId]) {
            return { ok: false, reason: 'Target node not found' };
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(rawJson);
        } catch (err) {
            return { ok: false, reason: err instanceof Error ? err.message : 'Invalid JSON' };
        }

        set((snapshot) => {
            if (!snapshot.document) return {};

            const nodes = { ...snapshot.document.nodes };
            const target = nodes[targetId];
            if (!target) return {};

            const beforeDoc = cloneDocument(snapshot.document);
            const beforeSelectedId = snapshot.selectedId;
            const beforeExpandedIds = [...snapshot.expandedIds];

            const appendToParent = (parentId: string, value: unknown, key?: string) => {
                const parent = nodes[parentId];
                if (!parent || !parent.children) return;

                const subtree = buildSubtreeFromValue(value, parentId, key);
                Object.entries(subtree.nodes).forEach(([id, node]) => {
                    if (parent.type === 'object' && id === subtree.rootId) {
                        node.key = ensureUniqueObjectKey(nodes, parentId, key || 'key');
                    }
                    nodes[id] = node;
                });

                nodes[parentId] = {
                    ...parent,
                    children: [...parent.children, subtree.rootId]
                };
            };

            if (mode === 'replace' || (target.type !== 'object' && target.type !== 'array')) {
                const descendants = collectDescendantIds(nodes, targetId);
                descendants.forEach((id) => delete nodes[id]);

                const subtree = buildSubtreeFromValue(parsed, target.parentId, target.key, targetId);
                Object.entries(subtree.nodes).forEach(([id, node]) => {
                    nodes[id] = node;
                });
            } else if (target.type === 'array') {
                if (mode === 'append' && Array.isArray(parsed)) {
                    parsed.forEach((item) => appendToParent(targetId, item));
                } else {
                    appendToParent(targetId, parsed);
                }
            } else if (target.type === 'object') {
                if (mode === 'append' && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => appendToParent(targetId, value, key));
                } else {
                    appendToParent(targetId, parsed, 'pasted');
                }
            }

            const nextDoc: JsonDocument = {
                rootId: snapshot.document.rootId,
                nodes
            };
            const nextExpandedIds = new Set(snapshot.expandedIds);
            nextExpandedIds.add(targetId);

            const command: HistoryCommand = {
                type: 'REPLACE_DOCUMENT',
                payload: {
                    before: beforeDoc,
                    after: cloneDocument(nextDoc),
                    beforeSelectedId,
                    afterSelectedId: snapshot.selectedId,
                    beforeExpandedIds,
                    afterExpandedIds: [...nextExpandedIds]
                }
            };

            return {
                document: nextDoc,
                expandedIds: nextExpandedIds,
                isDirty: true,
                undoStack: [...snapshot.undoStack, command],
                redoStack: []
            };
        });

        return { ok: true };
    },

    sortObjectKeys: (nodeId, direction = 'asc') => set((state) => {
        if (!state.document) return {};
        const node = state.document.nodes[nodeId];
        if (!node || node.type !== 'object' || !node.children) return {};

        const sorted = [...node.children].sort((leftId, rightId) => {
            const leftKey = state.document!.nodes[leftId]?.key || '';
            const rightKey = state.document!.nodes[rightId]?.key || '';
            return leftKey.localeCompare(rightKey);
        });
        if (direction === 'desc') sorted.reverse();
        if (sorted.every((id, index) => id === node.children![index])) return {};

        const beforeDoc = cloneDocument(state.document);
        const beforeSelectedId = state.selectedId;
        const beforeExpandedIds = [...state.expandedIds];

        const nextDoc: JsonDocument = {
            rootId: state.document.rootId,
            nodes: {
                ...state.document.nodes,
                [nodeId]: { ...node, children: sorted }
            }
        };

        const command: HistoryCommand = {
            type: 'REPLACE_DOCUMENT',
            payload: {
                before: beforeDoc,
                after: cloneDocument(nextDoc),
                beforeSelectedId,
                afterSelectedId: state.selectedId,
                beforeExpandedIds,
                afterExpandedIds: [...state.expandedIds]
            }
        };

        return {
            document: nextDoc,
            isDirty: true,
            undoStack: [...state.undoStack, command],
            redoStack: []
        };
    }),

    formatDocument: (mode) => {
        const state = get();
        if (!state.document) return;
        const json = astToJson(state.document);
        if (mode === 'sort') {
            state.replaceDocumentFromJson(sortJsonKeysDeep(json));
            return;
        }
        state.replaceDocumentFromJson(json);
    },

    applyDiffSelection: (entries) => {
        const state = get();
        if (!state.document || entries.length === 0) return;
        const currentJson = astToJson(state.document);
        const nextJson = applyJsonDiffEntries(currentJson, entries);
        state.replaceDocumentFromJson(nextJson);
    }
}));
