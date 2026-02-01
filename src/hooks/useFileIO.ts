import { useCallback } from 'react';
import { useJsonStore } from '../store/useJsonStore';
import { jsonToAst, astToJson } from '../utils/parser';

export const useFileIO = () => {
    const setDocument = useJsonStore((state) => state.setDocument);
    const document = useJsonStore((state) => state.document);

    const loadJson = useCallback((text: string) => {
        try {
            console.log("Parsing JSON content...");
            const json = JSON.parse(text);
            const ast = jsonToAst(json);
            console.log("AST created, setting document...", Object.keys(ast.nodes).length, "nodes");
            setDocument(ast);
            console.log("Document set.");
        } catch (err) {
            console.error("Failed to parse JSON", err);
            alert("Invalid JSON content: " + (err as any).message);
        }
    }, [setDocument]);

    const openFile = useCallback(() => {
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
            loadJson(text);
        };
        input.click();
    }, [loadJson]);

    const saveFile = useCallback(() => {
        if (!document) return;
        const json = astToJson(document);
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = window.document.createElement('a');
        a.href = url;
        a.download = 'edited.json';
        a.click();
        URL.revokeObjectURL(url);
    }, [document]);

    const handlePaste = useCallback((e: ClipboardEvent) => {
        // Only paste if not in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        const text = e.clipboardData?.getData('text');
        if (text) {
            // Heuristic: Is it JSON?
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                if (confirm("Paste JSON from clipboard? This will replace current document.")) {
                    loadJson(text);
                }
            }
        }
    }, [loadJson]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) {
            const text = await file.text();
            loadJson(text);
        }
    }, [loadJson]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    return { openFile, saveFile, handlePaste, handleDrop, handleDragOver };
};
