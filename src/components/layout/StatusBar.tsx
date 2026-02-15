import { useJsonStore } from '../../store/useJsonStore';

export const StatusBar = () => {
    const document = useJsonStore((state) => state.document);
    const isDirty = useJsonStore((state) => state.isDirty);
    const lastSavedAt = useJsonStore((state) => state.lastSavedAt);
    const nodeCount = document ? Object.keys(document.nodes).length : 0;
    const statusText = !document ? 'No Document' : isDirty ? 'Unsaved changes' : 'Saved';
    const rightText = lastSavedAt ? `Last saved: ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Ready';

    return (
        <div className="h-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center px-4 text-xs text-slate-500 dark:text-slate-300 justify-between shrink-0">
            <div className="flex items-center gap-4">
                <span>{statusText}</span>
                {document && <span>Nodes: {nodeCount}</span>}
            </div>
            <div>
                <span>{rightText}</span>
            </div>
        </div>
    );
};
