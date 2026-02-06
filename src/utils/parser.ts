import type { JsonDocument, JsonNode, JsonNodeType } from '../types';
import { generateId } from './id';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const jsonToAst = (json: JsonValue): JsonDocument => {
    const nodes: Record<string, JsonNode> = {};

    const parseNode = (value: JsonValue, parentId?: string, key?: string): string => {
        const id = generateId();
        let type: JsonNodeType;
        let nodeValue: string | number | boolean | null = null;
        let children: string[] | undefined = undefined;

        if (value === null) {
            type = 'null';
        } else if (Array.isArray(value)) {
            type = 'array';
            children = value.map((item) => parseNode(item, id));
        } else if (typeof value === 'object') {
            type = 'object';
            children = Object.entries(value).map(([k, v]) => parseNode(v, id, k));
        } else {
            type = typeof value as JsonNodeType;
            // Handle integers vs floats if needed, but for now just 'number'
            nodeValue = value;
        }

        const node: JsonNode = {
            id,
            type,
            parentId,
            key,
            value: nodeValue,
            children,
        };

        nodes[id] = node;
        return id;
    };

    const rootId = parseNode(json);
    return { rootId, nodes };
};

export const astToJson = (doc: JsonDocument): JsonValue => {
    const { rootId, nodes } = doc;

    const serializeNode = (nodeId: string): JsonValue => {
        const node = nodes[nodeId];
        if (!node) return null;

        switch (node.type) {
            case 'object': {
                const result: Record<string, JsonValue> = {};
                (node.children ?? []).forEach((childId) => {
                    const childNode = nodes[childId];
                    if (childNode && childNode.key) {
                        result[childNode.key] = serializeNode(childId);
                    }
                });
                return result;
            }
            case 'array': {
                return (node.children ?? []).map((childId) => serializeNode(childId));
            }
            case 'null':
                return null;
            default:
                return node.value ?? null;
        }
    };

    return serializeNode(rootId);
};
