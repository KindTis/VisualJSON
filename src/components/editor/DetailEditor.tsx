import { useJsonStore } from '../../store/useJsonStore';
import type { JsonNode, JsonNodeType } from '../../types';
import { PrimitiveEditor } from './PrimitiveEditor';
import { ObjectEditor } from './ObjectEditor';
import { ArrayEditor } from './ArrayEditor';
import { PathNavigator } from './PathNavigator';
import { SchemaPanel } from './SchemaPanel';

const NODE_TYPES: JsonNodeType[] = ['object', 'array', 'string', 'number', 'boolean', 'null'];

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
    const node = document && selectedId ? document.nodes[selectedId] : null;

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
                                <ObjectEditor node={node} />
                            ) : node.type === 'array' ? (
                                <ArrayEditor node={node} />
                            ) : (
                                <PrimitiveEditor node={node} />
                            )}
                        </div>
                    </>
                )}
            </div>

            <SchemaPanel />
        </div>
    );
};
