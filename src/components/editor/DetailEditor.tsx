import { useJsonStore } from '../../store/useJsonStore';
import type { JsonNode } from '../../types';
import { PrimitiveEditor } from './PrimitiveEditor';
import { ObjectEditor } from './ObjectEditor';
import { ArrayEditor } from './ArrayEditor';

const NodeMeta = ({ node }: { node: JsonNode }) => (
    <div className="mb-4 p-3 bg-white rounded border border-slate-200 shadow-sm">
        <div className="text-xs font-mono text-slate-400 mb-1">ID: {node.id}</div>
        <div className="flex gap-4 text-sm">
            <div>
                <span className="text-slate-500 mr-2">Type:</span>
                <span className="font-semibold">{node.type}</span>
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

    if (!document || !selectedId) {
        return <div className="text-slate-400 text-sm flex items-center justify-center h-full">Select a node to edit</div>;
    }

    const node = document.nodes[selectedId];
    if (!node) return <div>Node not found</div>;

    return (
        <div className="h-full overflow-auto">
            <NodeMeta node={node} />

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
