export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonNode {
    id: string;
    type: JsonNodeType;
    key?: string; // Only for children of an object
    value?: string | number | boolean | null; // For primitives
    children?: string[]; // IDs of children (for object/array)
    parentId?: string;
}

export interface JsonDocument {
    rootId: string;
    nodes: Record<string, JsonNode>;
}
