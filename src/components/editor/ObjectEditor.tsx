import { Plus, Trash2 } from 'lucide-react';
import type { JsonNode, JsonNodeType } from '../../types';
import { useJsonStore } from '../../store/useJsonStore';
import { useState } from 'react';

export const ObjectEditor = ({ node }: { node: JsonNode }) => {
    const document = useJsonStore((state) => state.document);
    const renameNodeKey = useJsonStore((state) => state.renameNodeKey);
    const deleteNode = useJsonStore((state) => state.deleteNode);
    const addNode = useJsonStore((state) => state.addNode);

    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyType, setNewKeyType] = useState<JsonNodeType>('string');

    if (!document) return null;

    const children = node.children?.map(id => document.nodes[id]) || [];

    const handleAdd = () => {
        if (!newKeyName.trim()) return;
        addNode(node.id, newKeyType, newKeyName);
        setNewKeyName('');
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase">Add Property</span>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Key"
                        className="flex-1 p-1 border rounded text-sm min-w-0"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                    />
                    <select
                        className="p-1 border rounded text-sm bg-white"
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

            <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Properties ({children.length})</span>
                {children.map(child => (
                    <div key={child.id} className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded hover:border-blue-200 group">
                        <input
                            type="text"
                            className="font-mono text-sm font-semibold text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-1/3"
                            value={child.key || ''}
                            onChange={(e) => renameNodeKey(child.id, e.target.value)}
                        />
                        <span className="text-xs text-slate-400 bg-slate-100 px-1 rounded">{child.type}</span>
                        <span className="flex-1 text-sm text-slate-500 truncate text-right px-2">
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
