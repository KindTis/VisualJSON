import { useJsonStore } from '../../store/useJsonStore';
import { TreeNode } from './TreeNode';
import { useMemo } from 'react';

interface FlatNode {
    id: string;
    depth: number;
}

export const TreeExplorer = () => {
    const document = useJsonStore((state) => state.document);
    const expandedIds = useJsonStore((state) => state.expandedIds);
    const selectedId = useJsonStore((state) => state.selectedId);
    const selectNode = useJsonStore((state) => state.selectNode);
    const toggleExpand = useJsonStore((state) => state.toggleExpand);
    const schemaErrors = useJsonStore((state) => state.schemaErrors);
    const schemaErrorNodeIds = useMemo(
        () => new Set(schemaErrors.map((error) => error.nodeId).filter((nodeId): nodeId is string => Boolean(nodeId))),
        [schemaErrors]
    );

    const visibleNodes = useMemo(() => {
        if (!document) return [];

        const result: FlatNode[] = [];

        // Depth-first traversal to flatten the tree based on expanded state
        const traverse = (nodeId: string, depth: number) => {
            const node = document.nodes[nodeId];
            if (!node) return;

            result.push({ id: nodeId, depth });

            if (expandedIds.has(nodeId) && node.children) {
                node.children.forEach((childId) => traverse(childId, depth + 1));
            }
        };

        traverse(document.rootId, 0);
        return result;
    }, [document, expandedIds]);

    if (!document) return <div className="p-4 text-slate-400 dark:text-slate-500 text-sm">No document loaded</div>;

    return (
        <div className="flex-1 overflow-auto h-full bg-white dark:bg-slate-800 relative">
            <div style={{ position: 'relative', height: visibleNodes.length * 24 }}>
                {visibleNodes.map((vn, index) => {
                    const node = document.nodes[vn.id];
                    if (!node) return null;

                    // Absolute positioning for precise layout
                    return (
                        <div key={vn.id} style={{ position: 'absolute', top: index * 24, left: 0, width: '100%', height: 24 }}>
                            <TreeNode
                                node={node}
                                depth={vn.depth}
                                isSelected={vn.id === selectedId}
                                isExpanded={expandedIds.has(vn.id)}
                                hasSchemaError={schemaErrorNodeIds.has(vn.id)}
                                onToggle={() => toggleExpand(vn.id)}
                                onSelect={() => selectNode(vn.id)}
                                childCount={node.children?.length}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
