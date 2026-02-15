import { Copy, Navigation } from 'lucide-react';
import { useState } from 'react';
import { useJsonStore } from '../../store/useJsonStore';

const copyText = async (text: string): Promise<void> => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textArea = window.document.createElement('textarea');
    textArea.value = text;
    window.document.body.appendChild(textArea);
    textArea.select();
    window.document.execCommand('copy');
    window.document.body.removeChild(textArea);
};

export const PathNavigator = () => {
    const document = useJsonStore((state) => state.document);
    const selectedId = useJsonStore((state) => state.selectedId);
    const buildJsonPath = useJsonStore((state) => state.buildJsonPath);
    const goToJsonPath = useJsonStore((state) => state.goToJsonPath);

    const currentPath = document && selectedId ? buildJsonPath(selectedId) : '$';
    const [pathInput, setPathInput] = useState('');
    const [feedback, setFeedback] = useState<string | null>(null);

    const handleCopy = async () => {
        try {
            await copyText(currentPath);
            setFeedback('Path copied');
        } catch (err) {
            setFeedback(err instanceof Error ? err.message : 'Failed to copy path');
        }
    };

    const handleGo = () => {
        const targetPath = pathInput.trim() || currentPath;
        const result = goToJsonPath(targetPath);
        if (result.ok) {
            setFeedback(null);
            return;
        }
        setFeedback(result.reason || 'Invalid path');
    };

    return (
        <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-500 dark:text-slate-300">
                    <span className="mr-2 font-semibold">Path:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-100 break-all">{currentPath}</span>
                </div>
                <button
                    onClick={() => { void handleCopy(); }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Copy JSONPath"
                >
                    <Copy size={12} />
                    Copy JSONPath
                </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
                <input
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    placeholder={currentPath}
                    className="flex-1 p-1.5 border border-slate-300 dark:border-slate-600 rounded text-sm font-mono bg-white dark:bg-slate-700 dark:text-slate-100"
                />
                <button
                    onClick={handleGo}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                    <Navigation size={14} />
                    Go
                </button>
            </div>

            {feedback && (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    {feedback}
                </div>
            )}
        </div>
    );
};
