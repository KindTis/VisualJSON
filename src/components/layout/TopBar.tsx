import { FolderOpen, Save, FilePlus, Undo2, Redo2, Search, ArrowUp, ArrowDown, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useJsonStore } from '../../store/useJsonStore';
import { useFileIO } from '../../hooks/useFileIO';

interface IconButtonProps {
    icon: LucideIcon;
    label?: string;
    onClick?: () => void | Promise<void>;
    disabled?: boolean;
}

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

export const TopBar = () => {
    const { openFile, saveFile, createNewDocument } = useFileIO();

    const undo = useJsonStore((state) => state.undo);
    const redo = useJsonStore((state) => state.redo);
    const canUndo = useJsonStore((state) => state.undoStack.length > 0);
    const canRedo = useJsonStore((state) => state.redoStack.length > 0);

    const searchQuery = useJsonStore((state) => state.searchQuery);
    const setSearchQuery = useJsonStore((state) => state.setSearchQuery);
    const nextSearchResult = useJsonStore((state) => state.nextSearchResult);
    const prevSearchResult = useJsonStore((state) => state.prevSearchResult);
    const searchResultsCount = useJsonStore((state) => state.searchResults.length);
    const currentSearchIndex = useJsonStore((state) => state.currentSearchIndex);
    const theme = useJsonStore((state) => state.theme);
    const toggleTheme = useJsonStore((state) => state.toggleTheme);

    return (
        <div className="h-12 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 justify-between bg-white dark:bg-slate-800 shrink-0">
            <div className="flex items-center gap-2">
                <IconButton icon={FolderOpen} label="Open" onClick={openFile} />
                <IconButton icon={FilePlus} label="New" onClick={createNewDocument} />
                <div className="w-px h-6 bg-slate-300 mx-2" />
                <IconButton icon={Save} label="Save" onClick={saveFile} />
            </div>

            <div className="flex items-center gap-2">
                <div className="relative group flex items-center gap-1">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <Search size={16} className="text-slate-400 dark:text-slate-500" />
                        </div>
                        <input
                            type="text"
                            className="bg-slate-100 border border-slate-200 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-64 pl-9 p-1.5"
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
            </div>

            <div className="flex items-center gap-2">
                <IconButton
                    icon={theme === 'dark' ? Sun : Moon}
                    label={theme === 'dark' ? 'Light' : 'Dark'}
                    onClick={toggleTheme}
                />
                <IconButton icon={Undo2} onClick={undo} disabled={!canUndo} />
                <IconButton icon={Redo2} onClick={redo} disabled={!canRedo} />
            </div>
        </div>
    );
};
