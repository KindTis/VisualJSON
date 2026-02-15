import {
    ArrowDown,
    ArrowUp,
    Command,
    Eye,
    FilePlus,
    FolderOpen,
    ListTree,
    Moon,
    Undo2,
    Redo2,
    Replace,
    Save,
    Search,
    Sparkles,
    Sun,
    Trash2,
    type LucideIcon
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useJsonStore } from '../../store/useJsonStore';
import { useFileIO } from '../../hooks/useFileIO';

interface IconButtonProps {
    icon: LucideIcon;
    label?: string;
    onClick?: () => void | Promise<void>;
    disabled?: boolean;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.isContentEditable) return true;
    const tagName = element.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

const IconButton = ({ icon: Icon, label, onClick, disabled }: IconButtonProps) => (
    <button
        onClick={() => { void onClick?.(); }}
        disabled={disabled}
        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
        title={label}
    >
        <Icon size={18} />
        {label && <span className="text-sm font-medium hidden md:inline">{label}</span>}
    </button>
);

type PaletteCommand = {
    id: string;
    label: string;
    shortcut?: string;
    run: () => void | Promise<void>;
};

export const TopBar = () => {
    const { openFile, saveFile, createNewDocument } = useFileIO();

    const undo = useJsonStore((state) => state.undo);
    const redo = useJsonStore((state) => state.redo);
    const canUndo = useJsonStore((state) => state.undoStack.length > 0);
    const canRedo = useJsonStore((state) => state.redoStack.length > 0);
    const viewMode = useJsonStore((state) => state.viewMode);
    const toggleViewMode = useJsonStore((state) => state.toggleViewMode);
    const toggleFocusMode = useJsonStore((state) => state.toggleFocusMode);
    const formatDocument = useJsonStore((state) => state.formatDocument);
    const batchDeleteSelected = useJsonStore((state) => state.batchDeleteSelected);
    const multiSelectedCount = useJsonStore((state) => state.multiSelectedIds.size);

    const searchQuery = useJsonStore((state) => state.searchQuery);
    const setSearchQuery = useJsonStore((state) => state.setSearchQuery);
    const nextSearchResult = useJsonStore((state) => state.nextSearchResult);
    const prevSearchResult = useJsonStore((state) => state.prevSearchResult);
    const searchResultsCount = useJsonStore((state) => state.searchResults.length);
    const currentSearchIndex = useJsonStore((state) => state.currentSearchIndex);
    const searchFilters = useJsonStore((state) => state.searchFilters);
    const setSearchFilters = useJsonStore((state) => state.setSearchFilters);

    const replaceTextValue = useJsonStore((state) => state.replaceTextValue);
    const setReplaceTextValue = useJsonStore((state) => state.setReplaceTextValue);
    const buildReplacePreview = useJsonStore((state) => state.buildReplacePreview);
    const applyReplacePreview = useJsonStore((state) => state.applyReplacePreview);
    const replacePreviewCount = useJsonStore((state) => state.replacePreview.length);

    const theme = useJsonStore((state) => state.theme);
    const toggleTheme = useJsonStore((state) => state.toggleTheme);

    const [replaceOpen, setReplaceOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [paletteQuery, setPaletteQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    const commands = useMemo<PaletteCommand[]>(() => ([
        { id: 'open', label: 'Open JSON file', shortcut: 'Ctrl+O', run: () => { void openFile(); } },
        { id: 'new', label: 'New document', shortcut: 'Ctrl+N', run: () => createNewDocument() },
        { id: 'save', label: 'Save document', shortcut: 'Ctrl+S', run: () => { void saveFile(); } },
        { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', run: undo },
        { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', run: redo },
        { id: 'toggle-view', label: 'Toggle tree/card view', run: toggleViewMode },
        { id: 'toggle-focus', label: 'Toggle focus mode on selected node', run: () => toggleFocusMode() },
        { id: 'format', label: 'Format JSON', run: () => formatDocument('pretty') },
        { id: 'minify', label: 'Minify JSON', run: () => formatDocument('minify') },
        { id: 'sort', label: 'Sort keys recursively', run: () => formatDocument('sort') },
        { id: 'replace-preview', label: 'Build replace preview', run: buildReplacePreview },
        { id: 'replace-apply', label: 'Apply replace preview', run: applyReplacePreview },
        { id: 'batch-delete', label: 'Delete multi-selected nodes', run: batchDeleteSelected }
    ]), [
        applyReplacePreview,
        batchDeleteSelected,
        buildReplacePreview,
        createNewDocument,
        formatDocument,
        openFile,
        redo,
        saveFile,
        toggleFocusMode,
        toggleViewMode,
        undo
    ]);

    const filteredCommands = useMemo(() => {
        const query = paletteQuery.trim().toLowerCase();
        if (!query) return commands;
        return commands.filter((command) => command.label.toLowerCase().includes(query));
    }, [commands, paletteQuery]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const lowerKey = event.key.toLowerCase();
            const inInput = isEditableTarget(event.target);

            if (event.ctrlKey && lowerKey === 'p') {
                event.preventDefault();
                setPaletteOpen(true);
                return;
            }

            if (event.ctrlKey && lowerKey === 's') {
                event.preventDefault();
                void saveFile();
                return;
            }

            if (event.ctrlKey && lowerKey === 'f') {
                event.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
                return;
            }

            if (event.ctrlKey && event.shiftKey && lowerKey === 'f') {
                event.preventDefault();
                setReplaceOpen(true);
                return;
            }

            if (inInput) return;

            if (event.key === 'Escape') {
                setPaletteOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [saveFile]);

    const runCommand = (command: PaletteCommand) => {
        void command.run();
        setPaletteOpen(false);
        setPaletteQuery('');
    };

    return (
        <>
            <div className="h-12 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 justify-between bg-white dark:bg-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                    <IconButton icon={FolderOpen} label="Open" onClick={openFile} />
                    <IconButton icon={FilePlus} label="New" onClick={createNewDocument} />
                    <div className="w-px h-6 bg-slate-300 mx-2" />
                    <IconButton icon={Save} label="Save" onClick={saveFile} />
                    <IconButton icon={Command} label="Palette" onClick={() => setPaletteOpen(true)} />
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative group flex items-center gap-1">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <Search size={16} className="text-slate-400 dark:text-slate-500" />
                            </div>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="bg-slate-100 border border-slate-200 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-56 lg:w-64 pl-9 p-1.5"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {searchResultsCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                                <span>{currentSearchIndex + 1}/{searchResultsCount}</span>
                                <button onClick={prevSearchResult} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><ArrowUp size={14} /></button>
                                <button onClick={nextSearchResult} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><ArrowDown size={14} /></button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setSearchFilters({ regex: !searchFilters.regex })}
                        className={`text-xs px-2 py-1 rounded border ${searchFilters.regex ? 'border-blue-500 text-blue-600 dark:text-blue-300' : 'border-slate-300 text-slate-500 dark:text-slate-300'}`}
                    >
                        Regex
                    </button>
                    <button
                        onClick={() => setSearchFilters({ caseSensitive: !searchFilters.caseSensitive })}
                        className={`text-xs px-2 py-1 rounded border ${searchFilters.caseSensitive ? 'border-blue-500 text-blue-600 dark:text-blue-300' : 'border-slate-300 text-slate-500 dark:text-slate-300'}`}
                    >
                        Aa
                    </button>
                    <IconButton icon={Replace} label="Replace" onClick={() => setReplaceOpen((value) => !value)} />
                </div>

                <div className="flex items-center gap-2">
                    <IconButton
                        icon={viewMode === 'tree' ? Eye : ListTree}
                        label={viewMode === 'tree' ? 'Card View' : 'Tree View'}
                        onClick={toggleViewMode}
                    />
                    {multiSelectedCount > 1 && (
                        <IconButton icon={Trash2} label={`Delete ${multiSelectedCount}`} onClick={batchDeleteSelected} />
                    )}
                    <IconButton icon={Sparkles} label="Format" onClick={() => formatDocument('sort')} />
                    <IconButton
                        icon={theme === 'dark' ? Sun : Moon}
                        label={theme === 'dark' ? 'Light' : 'Dark'}
                        onClick={toggleTheme}
                    />
                    <IconButton icon={Undo2} onClick={undo} disabled={!canUndo} />
                    <IconButton icon={Redo2} onClick={redo} disabled={!canRedo} />
                </div>
            </div>

            {replaceOpen && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 text-sm">
                    <span className="text-slate-500 dark:text-slate-300">Replace:</span>
                    <input
                        value={replaceTextValue}
                        onChange={(e) => setReplaceTextValue(e.target.value)}
                        className="w-56 p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                        placeholder="replacement text"
                    />
                    <button
                        onClick={buildReplacePreview}
                        className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                        Preview
                    </button>
                    <button
                        onClick={applyReplacePreview}
                        disabled={replacePreviewCount === 0}
                        className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        Apply ({replacePreviewCount})
                    </button>
                </div>
            )}

            {paletteOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-start justify-center" onClick={() => setPaletteOpen(false)}>
                    <div
                        className="mt-16 w-full max-w-2xl rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                            <input
                                autoFocus
                                value={paletteQuery}
                                onChange={(e) => setPaletteQuery(e.target.value)}
                                placeholder="Type a command..."
                                className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
                            />
                        </div>
                        <div className="max-h-80 overflow-auto p-2">
                            {filteredCommands.map((command) => (
                                <button
                                    key={command.id}
                                    onClick={() => runCommand(command)}
                                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                                >
                                    <span className="text-sm text-slate-800 dark:text-slate-100">{command.label}</span>
                                    {command.shortcut && (
                                        <span className="text-xs text-slate-400 dark:text-slate-300">{command.shortcut}</span>
                                    )}
                                </button>
                            ))}
                            {filteredCommands.length === 0 && (
                                <div className="px-3 py-6 text-sm text-slate-500 dark:text-slate-300">No commands found.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
