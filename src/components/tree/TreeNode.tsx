import { ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import type { JsonNode, JsonNodeType } from '../../types';

interface TreeNodeProps {
    node: JsonNode;
    depth: number;
    isSelected: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    onSelect: () => void;
    childCount?: number;
}

const TypeBadge = ({ type }: { type: JsonNodeType }) => {
    const colors = {
        object: 'bg-blue-100 text-blue-700',
        array: 'bg-orange-100 text-orange-700',
        string: 'bg-green-100 text-green-700',
        number: 'bg-purple-100 text-purple-700',
        boolean: 'bg-red-100 text-red-700',
        null: 'bg-slate-100 text-slate-600',
    };
    const labels = {
        object: 'obj',
        array: 'arr',
        string: 'str',
        number: 'num',
        boolean: 'bool',
        null: 'null',
    };

    return (
        <span className={clsx("text-[10px] px-1 rounded font-mono uppercase", colors[type])}>
            {labels[type]}
        </span>
    );
};

export const TreeNode = ({ node, depth, isSelected, isExpanded, onToggle, onSelect, childCount }: TreeNodeProps) => {
    const hasChildren = node.type === 'object' || node.type === 'array';

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggle();
    };

    return (
        <div
            className={clsx(
                "flex items-center h-6 px-2 cursor-pointer select-none text-sm font-mono whitespace-nowrap",
                isSelected ? "bg-blue-100" : "hover:bg-slate-50"
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={onSelect}
        >
            <div className="w-4 flex items-center justify-center shrink-0 mr-1" onClick={hasChildren ? handleToggle : undefined}>
                {hasChildren && (
                    isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
                )}
            </div>

            <div className="flex items-center gap-2 overflow-hidden text-ellipsis">
                {/* Key or Index */}
                {node.key !== undefined && (
                    <span className="font-semibold text-slate-700">{node.key}<span className="text-slate-400 font-normal">:</span></span>
                )}

                <TypeBadge type={node.type} />

                {/* Value Preview */}
                <span className="text-slate-600 truncate">
                    {hasChildren ? (
                        <span className="text-slate-400 italic">
                            {node.type === 'array' ? `[${childCount} items]` : `{${childCount} keys}`}
                        </span>
                    ) : (
                        node.type === 'string' ? `"${node.value}"` : String(node.value)
                    )}
                </span>
            </div>
        </div>
    );
};
