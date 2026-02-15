import { Clipboard, GitCompare, Merge } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useJsonStore } from '../../store/useJsonStore';
import { astToJson } from '../../utils/parser';
import { diffJson, type JsonDiffEntry } from '../../utils/jsonDiff';

interface SelectableDiffEntry extends JsonDiffEntry {
    selected: boolean;
}

export const DiffMergePanel = () => {
    const document = useJsonStore((state) => state.document);
    const applyDiffSelection = useJsonStore((state) => state.applyDiffSelection);

    const [sourceText, setSourceText] = useState('');
    const [entries, setEntries] = useState<SelectableDiffEntry[]>([]);
    const [error, setError] = useState<string | null>(null);

    const selectedCount = useMemo(
        () => entries.filter((entry) => entry.selected).length,
        [entries]
    );

    if (!document) return null;

    const handleCompare = (rawJson: string) => {
        try {
            const currentJson = astToJson(document);
            const incomingJson = JSON.parse(rawJson);
            const diff = diffJson(currentJson, incomingJson);
            setEntries(diff.map((entry) => ({ ...entry, selected: true })));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to compare');
            setEntries([]);
        }
    };

    const handleLoadClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setSourceText(text);
            handleCompare(text);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to read clipboard');
        }
    };

    const handleApplySelected = () => {
        const selected = entries.filter((entry) => entry.selected);
        if (selected.length === 0) return;
        applyDiffSelection(selected);
    };

    return (
        <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                    <GitCompare size={14} />
                    Diff / Merge
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-300">
                    Changes: {entries.length} | Selected: {selectedCount}
                </div>
            </div>

            <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder='Paste target JSON to compare'
                className="mt-2 w-full h-24 p-2 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono bg-white dark:bg-slate-700 dark:text-slate-100"
            />

            <div className="mt-2 flex items-center gap-2">
                <button
                    onClick={() => handleCompare(sourceText)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                    <GitCompare size={14} />
                    Compare
                </button>
                <button
                    onClick={() => { void handleLoadClipboard(); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                    <Clipboard size={14} />
                    Clipboard
                </button>
                <button
                    onClick={handleApplySelected}
                    disabled={selectedCount === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                    <Merge size={14} />
                    Apply Selected
                </button>
            </div>

            {error && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            <div className="mt-2 max-h-40 overflow-auto flex flex-col gap-1">
                {entries.map((entry, index) => (
                    <label
                        key={`${entry.path}-${index}`}
                        className="flex items-center gap-2 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs"
                    >
                        <input
                            type="checkbox"
                            checked={entry.selected}
                            onChange={(e) => {
                                const next = [...entries];
                                next[index] = { ...entry, selected: e.target.checked };
                                setEntries(next);
                            }}
                        />
                        <span className="font-mono text-blue-600 dark:text-blue-300">{entry.path}</span>
                        <span className="text-slate-500 dark:text-slate-300">{entry.kind}</span>
                    </label>
                ))}
                {entries.length === 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">No diff entries.</div>
                )}
            </div>
        </div>
    );
};
