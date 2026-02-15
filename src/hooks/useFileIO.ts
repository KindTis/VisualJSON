import { useCallback } from 'react';
import { useJsonStore } from '../store/useJsonStore';
import { jsonToAst, astToJson } from '../utils/parser';

type SaveFilePickerOptions = {
    suggestedName?: string;
    types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
    }>;
};

type FileWritable = {
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
};

type FileHandle = {
    name?: string;
    createWritable: () => Promise<FileWritable>;
};

type ShowSaveFilePicker = (options?: SaveFilePickerOptions) => Promise<FileHandle>;

export const useFileIO = () => {
    const setDocumentWithMeta = useJsonStore((state) => state.setDocumentWithMeta);
    const document = useJsonStore((state) => state.document);
    const setCurrentFileName = useJsonStore((state) => state.setCurrentFileName);
    const currentFileName = useJsonStore((state) => state.currentFileName);
    const isDirty = useJsonStore((state) => state.isDirty);
    const markSaved = useJsonStore((state) => state.markSaved);

    const confirmReplaceIfDirty = useCallback(() => {
        if (!isDirty) return true;
        return confirm("You have unsaved changes. Replacing the document will discard them. Continue?");
    }, [isDirty]);

    const loadJson = useCallback((text: string, fileName?: string) => {
        try {
            console.log("Parsing JSON content...");
            const json = JSON.parse(text);
            const ast = jsonToAst(json);
            console.log("AST created, setting document...", Object.keys(ast.nodes).length, "nodes");
            setDocumentWithMeta(ast, fileName, true);
            console.log("Document set.");
        } catch (err) {
            console.error("Failed to parse JSON", err);
            const message = err instanceof Error ? err.message : String(err);
            alert("Invalid JSON content: " + message);
        }
    }, [setDocumentWithMeta]);

    const createNewDocument = useCallback(() => {
        if (!confirmReplaceIfDirty()) return;
        const ast = jsonToAst({});
        setDocumentWithMeta(ast, 'untitled.json', true);
    }, [confirmReplaceIfDirty, setDocumentWithMeta]);

    const openFile = useCallback(() => {
        if (!confirmReplaceIfDirty()) return;
        console.log("Opening file dialog...");
        const input = window.document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            console.log("File selected");
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) {
                console.log("No file selected");
                return;
            }
            console.log("Reading file:", file.name, file.size);
            const text = await file.text();
            console.log("File text length:", text.length);
            loadJson(text, file.name);
        };
        input.click();
    }, [confirmReplaceIfDirty, loadJson]);

    const saveFile = useCallback(async () => {
        if (!document) return;
        const json = astToJson(document);
        const serialized = JSON.stringify(json, null, 2);

        const showSaveFilePicker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
        if (typeof showSaveFilePicker === 'function') {
            try {
                const handle = await showSaveFilePicker({
                    suggestedName: currentFileName || 'edited.json',
                    types: [
                        {
                            description: 'JSON',
                            accept: { 'application/json': ['.json'] },
                        },
                    ],
                });

                const writable = await handle.createWritable();
                await writable.write(serialized);
                await writable.close();
                setCurrentFileName(handle.name || currentFileName || 'edited.json');
                markSaved();
                return;
            } catch (err) {
                // User cancellation or unsupported write path; fall back to download.
                console.warn('Save picker failed; falling back to download.', err);
            }
        }

        const blob = new Blob([serialized], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = window.document.createElement('a');
        a.href = url;
        a.download = currentFileName || 'edited.json';
        a.click();
        URL.revokeObjectURL(url);
        markSaved();
    }, [document, currentFileName, setCurrentFileName, markSaved]);

    const handlePaste = useCallback((e: ClipboardEvent) => {
        // Only paste if not in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        const text = e.clipboardData?.getData('text');
        if (text) {
            // Heuristic: Is it JSON?
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                if (!confirmReplaceIfDirty()) return;
                if (confirm("Paste JSON from clipboard? This will replace current document.")) {
                    loadJson(text, 'pasted.json');
                }
            }
        }
    }, [confirmReplaceIfDirty, loadJson]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) {
            if (!confirmReplaceIfDirty()) return;
            const text = await file.text();
            loadJson(text, file.name);
        }
    }, [confirmReplaceIfDirty, loadJson]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    return { openFile, saveFile, createNewDocument, handlePaste, handleDrop, handleDragOver, loadJson };
};
