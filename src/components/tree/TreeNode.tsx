import { ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import type { JsonNode, JsonNodeType } from '../../types';
import { useJsonStore } from '../../store/useJsonStore';

interface TreeNodeProps {
    node: JsonNode;
    depth: number;
    isSelected: boolean;
    isMultiSelected: boolean;
    isExpanded: boolean;
    hasSchemaError?: boolean;
    onToggle: () => void;
    onSelect: (event: React.MouseEvent<HTMLDivElement>) => void;
    childCount?: number;
}

const TypeBadge = ({ type }: { type: JsonNodeType }) => {
    const colors = {
        object: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
        array: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
        string: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
        number: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200',
        boolean: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
        null: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
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
        <span className={clsx('text-[10px] px-1 rounded font-mono uppercase', colors[type])}>
            {labels[type]}
        </span>
    );
};

const parseInlineValue = (type: JsonNodeType, draft: string): string | number | boolean | null | undefined => {
    if (type === 'string') return draft;
    if (type === 'number') {
        const numeric = Number(draft);
        return Number.isNaN(numeric) ? undefined : numeric;
    }
    if (type === 'boolean') {
        const normalized = draft.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
        return undefined;
    }
    if (type === 'null') return null;
    return undefined;
};

export const TreeNode = ({ node, depth, isSelected, isMultiSelected, isExpanded, hasSchemaError, onToggle, onSelect, childCount }: TreeNodeProps) => {
    const hasChildren = node.type === 'object' || node.type === 'array';
    const renameNodeKey = useJsonStore((state) => state.renameNodeKey);
    const updateNodeValue = useJsonStore((state) => state.updateNodeValue);

    const [editingField, setEditingField] = useState<'key' | 'value' | null>(null);
    const [draft, setDraft] = useState('');

    const valuePreview = useMemo(() => {
        if (hasChildren) {
            return node.type === 'array' ? `[${childCount} items]` : `{${childCount} keys}`;
        }
        if (node.type === 'string') return `"${node.value}"`;
        return String(node.value);
    }, [childCount, hasChildren, node.type, node.value]);

    const startEdit = (field: 'key' | 'value') => {
        if (field === 'key') {
            if (!node.parentId || node.key === undefined) return;
            setDraft(node.key);
            setEditingField('key');
            return;
        }

        if (hasChildren || node.type === 'null') return;
        setDraft(node.value === null || node.value === undefined ? '' : String(node.value));
        setEditingField('value');
    };

    const commitEdit = () => {
        if (!editingField) return;
        if (editingField === 'key') {
            renameNodeKey(node.id, draft);
            setEditingField(null);
            return;
        }

        const nextValue = parseInlineValue(node.type, draft);
        if (nextValue !== undefined) {
            updateNodeValue(node.id, nextValue);
        }
        setEditingField(null);
    };

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggle();
    };

    return (
        <div
            className={clsx(
                'flex items-center h-6 px-2 cursor-pointer select-none text-sm font-mono whitespace-nowrap text-slate-800 dark:text-slate-200',
                isSelected ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-slate-50 dark:hover:bg-slate-700',
                isMultiSelected ? 'ring-1 ring-blue-400 dark:ring-blue-600' : '',
                hasSchemaError ? 'ring-1 ring-red-300 dark:ring-red-700' : ''
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={onSelect}
        >
            <div className="w-4 flex items-center justify-center shrink-0 mr-1" onClick={hasChildren ? handleToggle : undefined}>
                {hasChildren && (
                    isExpanded ? <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" /> : <ChevronRight size={14} className="text-slate-400 dark:text-slate-500" />
                )}
            </div>

            <div className="flex items-center gap-2 overflow-hidden text-ellipsis">
                {node.key !== undefined && (
                    editingField === 'key' ? (
                        <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Tab') {
                                    e.preventDefault();
                                    commitEdit();
                                }
                                if (e.key === 'Escape') setEditingField(null);
                            }}
                            className="w-40 border-b border-blue-500 bg-transparent outline-none text-sm font-semibold"
                        />
                    ) : (
                        <span
                            className="font-semibold text-slate-700 dark:text-slate-200"
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                startEdit('key');
                            }}
                        >
                            {node.key}<span className="text-slate-400 dark:text-slate-500 font-normal">:</span>
                        </span>
                    )
                )}

                <TypeBadge type={node.type} />

                {editingField === 'value' ? (
                    <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                commitEdit();
                            }
                            if (e.key === 'Escape') setEditingField(null);
                        }}
                        className="w-48 border-b border-blue-500 bg-transparent outline-none text-sm"
                    />
                ) : (
                    <span
                        className={clsx('text-slate-600 dark:text-slate-300 truncate', hasChildren ? 'italic text-slate-400 dark:text-slate-500' : '')}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            startEdit('value');
                        }}
                    >
                        {valuePreview}
                    </span>
                )}
            </div>
        </div>
    );
};
