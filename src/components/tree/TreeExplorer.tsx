import { useMemo } from 'react';
import { useJsonStore } from '../../store/useJsonStore';
import { TreeNode } from './TreeNode';

interface FlatNode {
    id: string;
    depth: number;
}

export const TreeExplorer = () => {
    const document = useJsonStore((state) => state.document);
    const expandedIds = useJsonStore((state) => state.expandedIds);
    const selectedId = useJsonStore((state) => state.selectedId);
    const viewMode = useJsonStore((state) => state.viewMode);
    const focusRootId = useJsonStore((state) => state.focusRootId);
    const multiSelectedIds = useJsonStore((state) => state.multiSelectedIds);
    const selectNode = useJsonStore((state) => state.selectNode);
    const toggleMultiSelect = useJsonStore((state) => state.toggleMultiSelect);
    const clearMultiSelect = useJsonStore((state) => state.clearMultiSelect);
    const toggleExpand = useJsonStore((state) => state.toggleExpand);
    const schemaErrors = useJsonStore((state) => state.schemaErrors);
    const schemaErrorNodeIds = useMemo(
        () => new Set(schemaErrors.map((error) => error.nodeId).filter((nodeId): nodeId is string => Boolean(nodeId))),
        [schemaErrors]
    );

    const visibleNodes = useMemo(() => {
        if (!document) return [];
        const result: FlatNode[] = [];

        const traverse = (nodeId: string, depth: number) => {
            const node = document.nodes[nodeId];
            if (!node) return;
            result.push({ id: nodeId, depth });

            if (expandedIds.has(nodeId) && node.children) {
                node.children.forEach((childId) => traverse(childId, depth + 1));
            }
        };

        const startNodeId = focusRootId && document.nodes[focusRootId] ? focusRootId : document.rootId;
        traverse(startNodeId, 0);
        return result;
    }, [document, expandedIds, focusRootId]);

    if (!document) return <div className="p-4 text-slate-400 dark:text-slate-500 text-sm">No document loaded</div>;

    if (viewMode === 'card') {
        return (
            <div className="flex-1 overflow-auto h-full bg-white dark:bg-slate-800 p-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
                {visibleNodes.map((visibleNode) => {
                    const node = document.nodes[visibleNode.id];
                    if (!node) return null;
                    const isSelected = visibleNode.id === selectedId;
                    const isMultiSelected = multiSelectedIds.has(visibleNode.id);

                    return (
                        <button
                            key={visibleNode.id}
                            onClick={(event) => {
                                if (event.ctrlKey || event.metaKey) {
                                    toggleMultiSelect(visibleNode.id);
                                    return;
                                }
                                clearMultiSelect();
                                selectNode(visibleNode.id);
                            }}
                            className={`text-left rounded border p-3 transition-colors ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'} ${isMultiSelected ? 'ring-1 ring-blue-400 dark:ring-blue-600' : ''}`}
                        >
                            <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Depth {visibleNode.depth}</div>
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {node.key ?? '(root/index)'}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-300 mt-1">{node.type}</div>
                            <div className="text-sm text-slate-700 dark:text-slate-200 mt-2 truncate">
                                {node.type === 'object' || node.type === 'array'
                                    ? `${node.type} (${node.children?.length ?? 0})`
                                    : String(node.value)}
                            </div>
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto h-full bg-white dark:bg-slate-800 relative">
            <div style={{ position: 'relative', height: visibleNodes.length * 24 }}>
                {visibleNodes.map((visibleNode, index) => {
                    const node = document.nodes[visibleNode.id];
                    if (!node) return null;

                    return (
                        <div key={visibleNode.id} style={{ position: 'absolute', top: index * 24, left: 0, width: '100%', height: 24 }}>
                            <TreeNode
                                node={node}
                                depth={visibleNode.depth}
                                isSelected={visibleNode.id === selectedId}
                                isMultiSelected={multiSelectedIds.has(visibleNode.id)}
                                isExpanded={expandedIds.has(visibleNode.id)}
                                hasSchemaError={schemaErrorNodeIds.has(visibleNode.id)}
                                onToggle={() => toggleExpand(visibleNode.id)}
                                onSelect={(event) => {
                                    if (event.ctrlKey || event.metaKey) {
                                        toggleMultiSelect(visibleNode.id);
                                        return;
                                    }
                                    clearMultiSelect();
                                    selectNode(visibleNode.id);
                                }}
                                childCount={node.children?.length}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
