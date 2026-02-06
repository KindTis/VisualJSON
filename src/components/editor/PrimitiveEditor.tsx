import type { JsonNode } from '../../types';
import { useJsonStore } from '../../store/useJsonStore';

interface PrimitiveEditorProps {
    node: JsonNode;
}

export const PrimitiveEditor = ({ node }: PrimitiveEditorProps) => {
    const updateNodeValue = useJsonStore((state) => state.updateNodeValue);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        let value: string | number = e.target.value;
        if (node.type === 'number') {
            value = Number(value);
        } else if (node.type === 'boolean') {
            // Handled by toggle
        }
        updateNodeValue(node.id, value);
    };

    const handleBooleanChange = () => {
        updateNodeValue(node.id, !(node.value as boolean));
    };

    if (node.type === 'string') {
        return (
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">String Value</label>
                <textarea
                    className="w-full p-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    rows={3}
                    value={node.value as string}
                    onChange={handleChange}
                />
            </div>
        );
    }

    if (node.type === 'number') {
        return (
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">Number Value</label>
                <input
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={node.value as number}
                    onChange={handleChange}
                />
            </div>
        );
    }

    if (node.type === 'boolean') {
        return (
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Boolean Value</label>
                <button
                    onClick={handleBooleanChange}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${node.value ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${node.value ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm font-mono">{String(node.value)}</span>
            </div>
        );
    }

    if (node.type === 'null') {
        return (
            <div className="text-sm text-slate-500 italic">
                Null value (Change type to edit)
            </div>
        );
    }

    return null;
};
