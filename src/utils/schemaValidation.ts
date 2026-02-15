import Ajv, { type AnySchema } from 'ajv';

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export interface SchemaValidationIssue {
    path: string;
    message: string;
    keyword: string;
}

const escapePathKey = (key: string): string => key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const appendKeySegment = (base: string, key: string): string => {
    if (IDENTIFIER_PATTERN.test(key)) return `${base}.${key}`;
    return `${base}['${escapePathKey(key)}']`;
};

const decodeJsonPointerToken = (token: string): string => token.replace(/~1/g, '/').replace(/~0/g, '~');

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
