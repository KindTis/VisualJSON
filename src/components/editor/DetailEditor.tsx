import { useJsonStore } from '../../store/useJsonStore';
import type { JsonNode, JsonNodeType } from '../../types';
import { PrimitiveEditor } from './PrimitiveEditor';
import { ObjectEditor } from './ObjectEditor';
import { ArrayEditor } from './ArrayEditor';

const NODE_TYPES: JsonNodeType[] = ['object', 'array', 'string', 'number', 'boolean', 'null'];

const NodeMeta = ({ node, onChangeType }: { node: JsonNode; onChangeType: (nextType: JsonNodeType) => void }) => (
    <div className="mb-4 p-3 bg-white rounded border border-slate-200 shadow-sm">
        <div className="text-xs font-mono text-slate-400 mb-1">ID: {node.id}</div>
        <div className="flex gap-4 text-sm">
            <div>
                <span className="text-slate-500 mr-2">Type:</span>
                <select
                    className="font-semibold border border-slate-300 rounded px-2 py-1 bg-white"
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
                <span className="text-slate-500 mr-2">Key:</span>
                <span className="font-semibold">{node.key || '(root/index)'}</span>
            </div>
        </div>
    </div>
);

export const DetailEditor = () => {
    const document = useJsonStore((state) => state.document);
    const selectedId = useJsonStore((state) => state.selectedId);
    const changeNodeType = useJsonStore((state) => state.changeNodeType);

    if (!document || !selectedId) {
        return <div className="text-slate-400 text-sm flex items-center justify-center h-full">Select a node to edit</div>;
    }

    const node = document.nodes[selectedId];
    if (!node) return <div>Node not found</div>;

    return (
        <div className="h-full overflow-auto">
            <NodeMeta node={node} onChangeType={(nextType) => changeNodeType(node.id, nextType)} />

            <div className="p-3 bg-white rounded border border-slate-200 shadow-sm">
                {node.type === 'object' ? (
                    <ObjectEditor node={node} />
                ) : node.type === 'array' ? (
                    <ArrayEditor node={node} />
                ) : (
                    <PrimitiveEditor node={node} />
                )}
            </div>
        </div>
    );
};
