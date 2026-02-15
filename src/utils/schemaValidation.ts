import Ajv, { type AnySchema } from 'ajv';

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export interface SchemaValidationIssue {
    path: string;
    message: string;
    keyword: string;
}

export type JsonPathSegment = { type: 'key'; value: string } | { type: 'index'; value: number };

export interface SchemaEditorHint {
    enumValues: Array<string | number | boolean | null>;
    requiredKeys: string[];
    propertySuggestions: Array<{
        key: string;
        type?: string;
        enumValues: Array<string | number | boolean | null>;
    }>;
}

const escapePathKey = (key: string): string => key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const appendKeySegment = (base: string, key: string): string => {
    if (IDENTIFIER_PATTERN.test(key)) return `${base}.${key}`;
    return `${base}['${escapePathKey(key)}']`;
};

const decodeJsonPointerToken = (token: string): string => token.replace(/~1/g, '/').replace(/~0/g, '~');

export const parseJsonPath = (path: string): JsonPathSegment[] | null => {
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

const normalizeSchemaType = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        const firstConcrete = value.find((item) => typeof item === 'string' && item !== 'null');
        return typeof firstConcrete === 'string' ? firstConcrete : undefined;
    }
    return undefined;
};

const asPrimitiveEnum = (value: unknown): Array<string | number | boolean | null> => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string | number | boolean | null => (
        typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null
    ));
};

export const getSchemaHintForPath = (schemaText: string, jsonPath: string): SchemaEditorHint | null => {
    if (!schemaText.trim()) return null;

    let schemaCursor: Record<string, unknown>;
    try {
        const parsed = JSON.parse(schemaText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        schemaCursor = parsed as Record<string, unknown>;
    } catch {
        return null;
    }

    const segments = parseJsonPath(jsonPath);
    if (!segments) return null;

    for (const segment of segments) {
        const cursorType = normalizeSchemaType(schemaCursor.type);

        if (segment.type === 'key') {
            if (cursorType !== 'object') return null;
            const props = schemaCursor.properties;
            const additionalProps = schemaCursor.additionalProperties;
            if (props && typeof props === 'object' && !Array.isArray(props)) {
                const next = (props as Record<string, unknown>)[segment.value];
                if (next && typeof next === 'object' && !Array.isArray(next)) {
                    schemaCursor = next as Record<string, unknown>;
                    continue;
                }
            }

            if (additionalProps && typeof additionalProps === 'object' && !Array.isArray(additionalProps)) {
                schemaCursor = additionalProps as Record<string, unknown>;
                continue;
            }

            return null;
        }

        if (cursorType !== 'array') return null;
        const items = schemaCursor.items;
        if (!items) return null;

        if (Array.isArray(items)) {
            const byIndex = items[segment.value];
            if (byIndex && typeof byIndex === 'object' && !Array.isArray(byIndex)) {
                schemaCursor = byIndex as Record<string, unknown>;
                continue;
            }
            return null;
        }

        if (typeof items === 'object' && !Array.isArray(items)) {
            schemaCursor = items as Record<string, unknown>;
            continue;
        }

        return null;
    }

    const requiredKeys = Array.isArray(schemaCursor.required)
        ? schemaCursor.required.filter((item): item is string => typeof item === 'string')
        : [];

    const propertySuggestions: SchemaEditorHint['propertySuggestions'] = [];
    if (schemaCursor.properties && typeof schemaCursor.properties === 'object' && !Array.isArray(schemaCursor.properties)) {
        Object.entries(schemaCursor.properties as Record<string, unknown>).forEach(([key, value]) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return;
            const propertySchema = value as Record<string, unknown>;
            propertySuggestions.push({
                key,
                type: normalizeSchemaType(propertySchema.type),
                enumValues: asPrimitiveEnum(propertySchema.enum)
            });
        });
    }

    return {
        enumValues: asPrimitiveEnum(schemaCursor.enum),
        requiredKeys,
        propertySuggestions
    };
};

export const jsonPointerToJsonPath = (pointer: string): string => {
    if (!pointer) return '$';

    return pointer
        .split('/')
        .slice(1)
        .reduce((path, token) => {
            const value = decodeJsonPointerToken(token);
            if (/^\d+$/.test(value)) return `${path}[${value}]`;
            return appendKeySegment(path, value);
        }, '$');
};

export const validateJsonWithSchema = (schemaText: string, jsonValue: unknown): SchemaValidationIssue[] => {
    if (!schemaText.trim()) return [];

    let parsedSchema: unknown;
    try {
        parsedSchema = JSON.parse(schemaText);
    } catch (err) {
        return [
            {
                path: '$',
                message: err instanceof Error ? err.message : String(err),
                keyword: 'schema-parse'
            }
        ];
    }

    const ajv = new Ajv({ allErrors: true, strict: false });
    let validate: ReturnType<Ajv['compile']>;
    try {
        validate = ajv.compile(parsedSchema as AnySchema);
    } catch (err) {
        return [
            {
                path: '$',
                message: err instanceof Error ? err.message : String(err),
                keyword: 'schema-compile'
            }
        ];
    }

    const valid = validate(jsonValue);
    if (valid) return [];

    return (validate.errors ?? []).map((error) => {
        let path = jsonPointerToJsonPath(error.instancePath || '');
        if (error.keyword === 'required') {
            const params = error.params as { missingProperty?: string };
            if (params.missingProperty) {
                path = appendKeySegment(path, params.missingProperty);
            }
        }

        return {
            path,
            message: error.message ?? 'Validation error',
            keyword: error.keyword
        };
    });
};
