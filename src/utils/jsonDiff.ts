import { parseJsonPath, type JsonPathSegment } from './schemaValidation';

type JsonObject = Record<string, unknown>;

export interface JsonDiffEntry {
    path: string;
    kind: 'add' | 'remove' | 'replace';
    currentValue: unknown;
    incomingValue: unknown;
}

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const isObject = (value: unknown): value is JsonObject => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isEqualValue = (left: unknown, right: unknown): boolean => {
    if (left === right) return true;
    return JSON.stringify(left) === JSON.stringify(right);
};

const escapePathKey = (key: string): string => key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const appendKeySegment = (base: string, key: string): string => {
    if (IDENTIFIER_PATTERN.test(key)) return `${base}.${key}`;
    return `${base}['${escapePathKey(key)}']`;
};

const appendIndexSegment = (base: string, index: number): string => `${base}[${index}]`;

export const diffJson = (current: unknown, incoming: unknown): JsonDiffEntry[] => {
    const diffs: JsonDiffEntry[] = [];

    const walk = (path: string, left: unknown, right: unknown) => {
        if (isEqualValue(left, right)) return;

        if (Array.isArray(left) && Array.isArray(right)) {
            const maxLength = Math.max(left.length, right.length);
            for (let index = 0; index < maxLength; index += 1) {
                if (index >= left.length) {
                    diffs.push({
                        path: appendIndexSegment(path, index),
                        kind: 'add',
                        currentValue: undefined,
                        incomingValue: right[index]
                    });
                    continue;
                }
                if (index >= right.length) {
                    diffs.push({
                        path: appendIndexSegment(path, index),
                        kind: 'remove',
                        currentValue: left[index],
                        incomingValue: undefined
                    });
                    continue;
                }
                walk(appendIndexSegment(path, index), left[index], right[index]);
            }
            return;
        }

        if (isObject(left) && isObject(right)) {
            const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
            Array.from(keys).sort().forEach((key) => {
                if (!(key in left)) {
                    diffs.push({
                        path: appendKeySegment(path, key),
                        kind: 'add',
                        currentValue: undefined,
                        incomingValue: right[key]
                    });
                    return;
                }
                if (!(key in right)) {
                    diffs.push({
                        path: appendKeySegment(path, key),
                        kind: 'remove',
                        currentValue: left[key],
                        incomingValue: undefined
                    });
                    return;
                }
                walk(appendKeySegment(path, key), left[key], right[key]);
            });
            return;
        }

        diffs.push({
            path,
            kind: 'replace',
            currentValue: left,
            incomingValue: right
        });
    };

    walk('$', current, incoming);
    return diffs;
};

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const applySetBySegments = (target: unknown, segments: JsonPathSegment[], value: unknown): unknown => {
    if (segments.length === 0) return cloneValue(value);

    const root = cloneValue(target);
    let cursor: unknown = root;

    for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index];
        const nextSegment = segments[index + 1];

        if (segment.type === 'key') {
            if (!isObject(cursor)) return root;
            if (!(segment.value in cursor) || cursor[segment.value] === undefined || cursor[segment.value] === null) {
                cursor[segment.value] = nextSegment.type === 'index' ? [] : {};
            }
            cursor = cursor[segment.value];
            continue;
        }

        if (!Array.isArray(cursor)) return root;
        if (segment.value >= cursor.length) {
            while (cursor.length <= segment.value) {
                cursor.push(nextSegment.type === 'index' ? [] : {});
            }
        }
        if (cursor[segment.value] === undefined || cursor[segment.value] === null) {
            cursor[segment.value] = nextSegment.type === 'index' ? [] : {};
        }
        cursor = cursor[segment.value];
    }

    const last = segments[segments.length - 1];
    if (last.type === 'key') {
        if (!isObject(cursor)) return root;
        cursor[last.value] = cloneValue(value);
    } else if (Array.isArray(cursor)) {
        if (last.value >= cursor.length) {
            while (cursor.length < last.value) {
                cursor.push(null);
            }
            cursor.push(cloneValue(value));
        } else {
            cursor[last.value] = cloneValue(value);
        }
    }

    return root;
};

const applyDeleteBySegments = (target: unknown, segments: JsonPathSegment[]): unknown => {
    if (segments.length === 0) return null;

    const root = cloneValue(target);
    let cursor: unknown = root;

    for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index];
        if (segment.type === 'key') {
            if (!isObject(cursor) || !(segment.value in cursor)) return root;
            cursor = cursor[segment.value];
        } else {
            if (!Array.isArray(cursor) || segment.value < 0 || segment.value >= cursor.length) return root;
            cursor = cursor[segment.value];
        }
    }

    const last = segments[segments.length - 1];
    if (last.type === 'key') {
        if (!isObject(cursor)) return root;
        delete cursor[last.value];
        return root;
    }

    if (!Array.isArray(cursor) || last.value < 0 || last.value >= cursor.length) return root;
    cursor.splice(last.value, 1);
    return root;
};

export const applyDiffEntries = (current: unknown, entries: JsonDiffEntry[]): unknown => {
    let next = cloneValue(current);

    entries.forEach((entry) => {
        const segments = parseJsonPath(entry.path);
        if (!segments) return;
        if (entry.kind === 'remove') {
            next = applyDeleteBySegments(next, segments);
            return;
        }
        next = applySetBySegments(next, segments, entry.incomingValue);
    });

    return next;
};
