import { Plus, Trash2 } from 'lucide-react';
import type { JsonNode, JsonNodeType } from '../../types';
import { useJsonStore } from '../../store/useJsonStore';
import { useState } from 'react';
import type { SchemaEditorHint } from '../../utils/schemaValidation';

const toNodeType = (schemaType?: string): JsonNodeType => {
    if (schemaType === 'object') return 'object';
    if (schemaType === 'array') return 'array';
    if (schemaType === 'number' || schemaType === 'integer') return 'number';
    if (schemaType === 'boolean') return 'boolean';
    if (schemaType === 'null') return 'null';
    return 'string';
};

export const ObjectEditor = ({ node, schemaHint }: { node: JsonNode; schemaHint?: SchemaEditorHint | null }) => {
    const document = useJsonStore((state) => state.document);
    const renameNodeKey = useJsonStore((state) => state.renameNodeKey);
    const deleteNode = useJsonStore((state) => state.deleteNode);
    const addNode = useJsonStore((state) => state.addNode);
    const sortObjectKeys = useJsonStore((state) => state.sortObjectKeys);

    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyType, setNewKeyType] = useState<JsonNodeType>('string');

    if (!document) return null;

    const children = node.children?.map(id => document.nodes[id]) || [];

    const handleAdd = () => {
        if (!newKeyName.trim()) return;
        addNode(node.id, newKeyType, newKeyName);
        setNewKeyName('');
    };

    const missingRequiredKeys = (schemaHint?.requiredKeys ?? []).filter(
        (requiredKey) => !children.some((child) => child.key === requiredKey)
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-end gap-2">
                <button
                    onClick={() => sortObjectKeys(node.id, 'asc')}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                    Sort A-Z
                </button>
                <button
                    onClick={() => sortObjectKeys(node.id, 'desc')}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                    Sort Z-A
                </button>
            </div>

            <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Add Property</span>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Key"
                        className="flex-1 p-1 border border-slate-300 dark:border-slate-600 rounded text-sm min-w-0 bg-white dark:bg-slate-700 dark:text-slate-100"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                    />
                    <select
                        className="p-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                        value={newKeyType}
                        onChange={(e) => setNewKeyType(e.target.value as JsonNodeType)}
                    >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="null">Null</option>
                        <option value="object">Object</option>
                        <option value="array">Array</option>
                    </select>
                    <button onClick={handleAdd} className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {missingRequiredKeys.length > 0 && (
                <div className="p-3 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                    <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase">Missing Required</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {missingRequiredKeys.map((requiredKey) => (
                            <button
                                key={requiredKey}
                                onClick={() => addNode(node.id, 'string', requiredKey)}
                                className="px-2 py-1 rounded text-xs border border-amber-400 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-800"
                            >
                                + {requiredKey}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {schemaHint && schemaHint.propertySuggestions.length > 0 && (
                <div className="p-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Schema Suggestions</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {schemaHint.propertySuggestions.map((suggestion) => (
                            <button
                                key={suggestion.key}
                                onClick={() => addNode(node.id, toNodeType(suggestion.type), suggestion.key)}
                                className="px-2 py-1 rounded text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                + {suggestion.key}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Properties ({children.length})</span>
                {children.map(child => (
                    <div key={child.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded hover:border-blue-200 dark:hover:border-blue-700 group">
                        <input
                            type="text"
                            className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-500 focus:border-blue-500 outline-none w-1/3"
                            value={child.key || ''}
                            onChange={(e) => renameNodeKey(child.id, e.target.value)}
                        />
                        <span className="text-xs text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1 rounded">{child.type}</span>
                        <span className="flex-1 text-sm text-slate-500 dark:text-slate-300 truncate text-right px-2">
                            {/* Preview value */}
                            {child.type === 'object' || child.type === 'array' ? '...' : String(child.value)}
                        </span>
                        <button
                            onClick={() => deleteNode(child.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
