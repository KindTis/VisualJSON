import { useState } from 'react';
import { useJsonStore } from '../../store/useJsonStore';
import type { JsonNode, JsonNodeType } from '../../types';
import { PrimitiveEditor } from './PrimitiveEditor';
import { ObjectEditor } from './ObjectEditor';
import { ArrayEditor } from './ArrayEditor';
import { PathNavigator } from './PathNavigator';
import { SchemaPanel } from './SchemaPanel';
import { DiffMergePanel } from './DiffMergePanel';
import { getSchemaHintForPath } from '../../utils/schemaValidation';

const NODE_TYPES: JsonNodeType[] = ['object', 'array', 'string', 'number', 'boolean', 'null'];
type BottomTab = 'diff' | 'schema';

const NodeMeta = ({ node, onChangeType }: { node: JsonNode; onChangeType: (nextType: JsonNodeType) => void }) => (
    <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="text-xs font-mono text-slate-400 dark:text-slate-500 mb-1">ID: {node.id}</div>
        <div className="flex gap-4 text-sm">
            <div>
                <span className="text-slate-500 dark:text-slate-300 mr-2">Type:</span>
                <select
                    className="font-semibold border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 dark:text-slate-100"
                    value={node.type}
                    onChange={(e) => onChangeType(e.target.value as JsonNodeType)}
                >
                    {NODE_TYPES.map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <span className="text-slate-500 dark:text-slate-300 mr-2">Key:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{node.key || '(root/index)'}</span>
            </div>
        </div>
    </div>
);

export const DetailEditor = () => {
    const document = useJsonStore((state) => state.document);
    const selectedId = useJsonStore((state) => state.selectedId);
    const changeNodeType = useJsonStore((state) => state.changeNodeType);
    const schemaText = useJsonStore((state) => state.schemaText);
    const buildJsonPath = useJsonStore((state) => state.buildJsonPath);
    const node = document && selectedId ? document.nodes[selectedId] : null;
    const path = node ? buildJsonPath(node.id) : '$';
    const schemaHint = getSchemaHintForPath(schemaText, path);
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
    const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('schema');

    const toggleBottomTab = (tab: BottomTab) => {
        if (isBottomPanelOpen && activeBottomTab === tab) {
            setIsBottomPanelOpen(false);
            return;
        }
        setActiveBottomTab(tab);
        setIsBottomPanelOpen(true);
    };

    return (
        <div className="h-full flex flex-col">
            <PathNavigator />

            <div className="flex-1 overflow-auto">
                {!document || !selectedId ? (
                    <div className="text-slate-400 dark:text-slate-500 text-sm flex items-center justify-center h-full">Select a node to edit</div>
                ) : !node ? (
                    <div>Node not found</div>
                ) : (
                    <>
                        <NodeMeta node={node} onChangeType={(nextType) => changeNodeType(node.id, nextType)} />
                        <div className="p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
                            {node.type === 'object' ? (
                                <ObjectEditor node={node} schemaHint={schemaHint} />
                            ) : node.type === 'array' ? (
                                <ArrayEditor node={node} />
                            ) : (
                                <PrimitiveEditor node={node} schemaHint={schemaHint} />
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="mt-3 shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => toggleBottomTab('diff')}
                        className={`px-2.5 py-1.5 rounded border text-xs ${isBottomPanelOpen && activeBottomTab === 'diff'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-300'
                            : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                    >
                        Diff / Merge
                    </button>
                    <button
                        onClick={() => toggleBottomTab('schema')}
                        className={`px-2.5 py-1.5 rounded border text-xs ${isBottomPanelOpen && activeBottomTab === 'schema'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-300'
                            : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                    >
                        Schema Validation
                    </button>
                    {isBottomPanelOpen && (
                        <button
                            onClick={() => setIsBottomPanelOpen(false)}
                            className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                            Close
                        </button>
                    )}
                </div>

                {isBottomPanelOpen && (
                    activeBottomTab === 'diff' ? <DiffMergePanel /> : <SchemaPanel />
                )}
            </div>
        </div>
    );
};
