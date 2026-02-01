import { useJsonStore } from '../../store/useJsonStore';

export const StatusBar = () => {
    const document = useJsonStore((state) => state.document);
    const nodeCount = document ? Object.keys(document.nodes).length : 0;

    return (
        <div className="h-6 border-t border-slate-200 bg-slate-50 flex items-center px-4 text-xs text-slate-500 justify-between shrink-0">
            <div className="flex items-center gap-4">
                <span>{document ? 'Document Loaded' : 'No Document'}</span>
                {document && <span>Nodes: {nodeCount}</span>}
            </div>
            <div>
                <span>Ready</span>
            </div>
        </div>
    );
};
