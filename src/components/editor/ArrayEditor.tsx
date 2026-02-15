import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { JsonNode, JsonNodeType } from '../../types';
import { useJsonStore } from '../../store/useJsonStore';
import { useState } from 'react';

interface SortableArrayItemProps {
    child: JsonNode;
    index: number;
    totalCount: number;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}

const SortableArrayItem = ({ child, index, totalCount, onDelete, onMoveUp, onMoveDown }: SortableArrayItemProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: child.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border rounded group ${isDragging ? 'border-blue-300 dark:border-blue-700 shadow-sm opacity-80' : 'border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700'
                }`}
        >
            <button
                type="button"
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
                {...attributes}
                {...listeners}
            >
                <GripVertical size={14} />
            </button>

            <span className="font-mono text-xs text-slate-400 dark:text-slate-500 w-6 text-center">{index}</span>
            <span className="text-xs text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1 rounded">{child.type}</span>

            <span className="flex-1 text-sm text-slate-500 dark:text-slate-300 truncate px-2">
                {child.type === 'object' || child.type === 'array' ? '...' : String(child.value)}
            </span>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={onMoveUp}
                    disabled={index === 0}
                    className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:text-slate-300 dark:disabled:text-slate-700 disabled:cursor-not-allowed"
                    title="Move up"
                >
                    <ChevronUp size={14} />
                </button>
                <button
                    type="button"
                    onClick={onMoveDown}
                    disabled={index === totalCount - 1}
                    className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:text-slate-300 dark:disabled:text-slate-700 disabled:cursor-not-allowed"
                    title="Move down"
                >
                    <ChevronDown size={14} />
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity"
                    title="Delete"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

export const ArrayEditor = ({ node }: { node: JsonNode }) => {
    const document = useJsonStore((state) => state.document);
    const deleteNode = useJsonStore((state) => state.deleteNode);
    const addNode = useJsonStore((state) => state.addNode);
    const moveArrayItem = useJsonStore((state) => state.moveArrayItem);

    const [newItemType, setNewItemType] = useState<JsonNodeType>('string');
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    if (!document) return null;

    const children = (node.children ?? [])
        .map((id) => document.nodes[id])
        .filter((child): child is JsonNode => Boolean(child));

    const handleAdd = () => {
        addNode(node.id, newItemType);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const fromIndex = children.findIndex((child) => child.id === String(active.id));
        const toIndex = children.findIndex((child) => child.id === String(over.id));
        if (fromIndex === -1 || toIndex === -1) return;

        moveArrayItem(node.id, fromIndex, toIndex);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Add Item</span>
                <div className="flex gap-2">
                    <select
                        className="flex-1 p-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
                        value={newItemType}
                        onChange={(e) => setNewItemType(e.target.value as JsonNodeType)}
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
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Items ({children.length})</span>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={children.map((child) => child.id)} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-2">
                            {children.map((child, index) => (
                                <SortableArrayItem
                                    key={child.id}
                                    child={child}
                                    index={index}
                                    totalCount={children.length}
                                    onMoveUp={() => moveArrayItem(node.id, index, index - 1)}
                                    onMoveDown={() => moveArrayItem(node.id, index, index + 1)}
                                    onDelete={() => deleteNode(child.id)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
};
