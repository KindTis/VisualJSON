import { Copy, Focus, Navigation, Pin, PinOff, ClipboardPaste } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
    const copyNodeJson = useJsonStore((state) => state.copyNodeJson);
    const pasteNodeJson = useJsonStore((state) => state.pasteNodeJson);
    const toggleFocusMode = useJsonStore((state) => state.toggleFocusMode);
    const clearFocusMode = useJsonStore((state) => state.clearFocusMode);
    const focusRootId = useJsonStore((state) => state.focusRootId);
    const bookmarks = useJsonStore((state) => state.bookmarks);
    const addCurrentPathBookmark = useJsonStore((state) => state.addCurrentPathBookmark);
    const removeBookmark = useJsonStore((state) => state.removeBookmark);
    const jumpBookmark = useJsonStore((state) => state.jumpBookmark);

    const currentPath = document && selectedId ? buildJsonPath(selectedId) : '$';
    const [pathInput, setPathInput] = useState('');
    const [feedback, setFeedback] = useState<string | null>(null);
    const [pasteMode, setPasteMode] = useState<'replace' | 'append' | 'insert'>('replace');
    const loadedBookmarks = useRef(false);

    useEffect(() => {
        if (loadedBookmarks.current) return;
        loadedBookmarks.current = true;
        const raw = window.localStorage.getItem('visualjson-bookmarks-v1');
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            parsed.forEach((path) => {
                if (typeof path === 'string') {
                    useJsonStore.getState().addBookmark(path);
                }
            });
        } catch {
            // Ignore malformed storage
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem('visualjson-bookmarks-v1', JSON.stringify(bookmarks));
    }, [bookmarks]);

    const handleCopyPath = async () => {
        try {
            await copyText(currentPath);
            setFeedback('Path copied');
        } catch (err) {
            setFeedback(err instanceof Error ? err.message : 'Failed to copy path');
        }
    };

    const handleCopyNode = async () => {
        if (!selectedId) return;
        const payload = copyNodeJson(selectedId);
        if (!payload) {
            setFeedback('Node copy failed');
            return;
        }
        try {
            await copyText(payload);
            setFeedback('Node JSON copied');
        } catch (err) {
            setFeedback(err instanceof Error ? err.message : 'Copy failed');
        }
    };

    const handlePasteNode = async () => {
        if (!selectedId) return;
        try {
            const text = await navigator.clipboard.readText();
            const result = pasteNodeJson(selectedId, text, pasteMode);
            setFeedback(result.ok ? 'Node pasted' : result.reason || 'Paste failed');
        } catch (err) {
            setFeedback(err instanceof Error ? err.message : 'Clipboard read failed');
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
            <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-slate-500 dark:text-slate-300">
                    <span className="mr-2 font-semibold">Path:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-100 break-all">{currentPath}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { void handleCopyPath(); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Copy JSONPath"
                    >
                        <Copy size={12} />
                        Path
                    </button>
                    <button
                        onClick={() => { void handleCopyNode(); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Copy selected node JSON"
                    >
                        <Copy size={12} />
                        Node
                    </button>
                    <button
                        onClick={() => (focusRootId ? clearFocusMode() : toggleFocusMode())}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <Focus size={12} />
                        {focusRootId ? 'Clear Focus' : 'Focus'}
                    </button>
                    <button
                        onClick={addCurrentPathBookmark}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <Pin size={12} />
                        Bookmark
                    </button>
                </div>
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

            <div className="mt-2 flex items-center gap-2">
                <select
                    value={pasteMode}
                    onChange={(e) => setPasteMode(e.target.value as 'replace' | 'append' | 'insert')}
                    className="p-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-700 dark:text-slate-100"
                >
                    <option value="replace">Replace</option>
                    <option value="append">Append</option>
                    <option value="insert">Insert</option>
                </select>
                <button
                    onClick={() => { void handlePasteNode(); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                    <ClipboardPaste size={12} />
                    Paste Node JSON
                </button>
            </div>

            {bookmarks.length > 0 && (
                <div className="mt-3 p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1">Bookmarks</div>
                    <div className="flex flex-col gap-1 max-h-24 overflow-auto">
                        {bookmarks.map((bookmark) => (
                            <div key={bookmark} className="flex items-center gap-1">
                                <button
                                    onClick={() => jumpBookmark(bookmark)}
                                    className="flex-1 text-left text-xs font-mono px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                                >
                                    {bookmark}
                                </button>
                                <button
                                    onClick={() => removeBookmark(bookmark)}
                                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
                                >
                                    <PinOff size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {feedback && (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    {feedback}
                </div>
            )}
        </div>
    );
};
