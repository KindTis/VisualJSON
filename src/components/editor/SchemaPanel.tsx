import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useJsonStore } from '../../store/useJsonStore';
import { astToJson } from '../../utils/parser';
import { validateJsonWithSchema } from '../../utils/schemaValidation';

const SCHEMA_STORAGE_KEY = 'visualjson-schema-v1';

export const SchemaPanel = () => {
    const document = useJsonStore((state) => state.document);
    const schemaText = useJsonStore((state) => state.schemaText);
    const schemaValidationEnabled = useJsonStore((state) => state.schemaValidationEnabled);
    const blockSaveOnSchemaError = useJsonStore((state) => state.blockSaveOnSchemaError);
    const schemaErrors = useJsonStore((state) => state.schemaErrors);
    const setSchemaText = useJsonStore((state) => state.setSchemaText);
    const setSchemaValidationEnabled = useJsonStore((state) => state.setSchemaValidationEnabled);
    const setBlockSaveOnSchemaError = useJsonStore((state) => state.setBlockSaveOnSchemaError);
    const setSchemaErrors = useJsonStore((state) => state.setSchemaErrors);
    const resolvePathToNodeId = useJsonStore((state) => state.resolvePathToNodeId);
    const focusNodeWithAncestors = useJsonStore((state) => state.focusNodeWithAncestors);
    const didLoadStoredSchema = useRef(false);

    useEffect(() => {
        if (didLoadStoredSchema.current) return;
        didLoadStoredSchema.current = true;

        const savedSchemaText = window.localStorage.getItem(SCHEMA_STORAGE_KEY);
        if (savedSchemaText !== null) {
            setSchemaText(savedSchemaText);
        }
    }, [setSchemaText]);

    useEffect(() => {
        window.localStorage.setItem(SCHEMA_STORAGE_KEY, schemaText);
    }, [schemaText]);

    useEffect(() => {
        if (!schemaValidationEnabled || !document) {
            setSchemaErrors([]);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            const jsonValue = astToJson(document);
            const rawErrors = validateJsonWithSchema(schemaText, jsonValue);
            const mappedErrors = rawErrors.map((error) => ({
                ...error,
                nodeId: resolvePathToNodeId(error.path) || undefined
            }));
            setSchemaErrors(mappedErrors);
        }, 400);

        return () => window.clearTimeout(timeoutId);
    }, [document, schemaText, schemaValidationEnabled, resolvePathToNodeId, setSchemaErrors]);

    const errorCount = schemaErrors.length;
    const statusView = useMemo(() => {
        if (!schemaValidationEnabled) {
            return <span className="text-xs text-slate-500 dark:text-slate-400">Validation disabled</span>;
        }

        if (errorCount === 0) {
            return (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={12} />
                    No validation errors
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle size={12} />
                {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
        );
    }, [errorCount, schemaValidationEnabled]);

    return (
        <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Schema Validation</h3>
                {statusView}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                <label className="inline-flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={schemaValidationEnabled}
                        onChange={(e) => setSchemaValidationEnabled(e.target.checked)}
                    />
                    Enable validation
                </label>
                <label className="inline-flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={blockSaveOnSchemaError}
                        onChange={(e) => setBlockSaveOnSchemaError(e.target.checked)}
                    />
                    Block save when errors exist
                </label>
            </div>

            <textarea
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
                placeholder='{"type":"object","properties":{...}}'
                className="mt-3 w-full h-28 p-2 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono bg-white dark:bg-slate-700 dark:text-slate-100"
            />

            <div className="mt-3">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1">
                    Errors ({errorCount})
                </div>

                <div className="max-h-40 overflow-auto flex flex-col gap-1">
                    {schemaErrors.map((error, index) => (
                        <button
                            key={`${error.path}-${error.keyword}-${index}`}
                            disabled={!error.nodeId}
                            onClick={() => error.nodeId && focusNodeWithAncestors(error.nodeId)}
                            className="text-left px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-70 disabled:cursor-default"
                        >
                            <div className="text-[11px] font-mono text-blue-600 dark:text-blue-300">{error.path}</div>
                            <div className="text-xs text-slate-700 dark:text-slate-200">{error.message}</div>
                            {!error.nodeId && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">No matching node in tree</div>
                            )}
                        </button>
                    ))}
                    {schemaErrors.length === 0 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            No errors to display.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
