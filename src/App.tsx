import { TopBar } from './components/layout/TopBar';
import { StatusBar } from './components/layout/StatusBar';
import { TreeExplorer } from './components/tree/TreeExplorer';
import { DetailEditor } from './components/editor/DetailEditor';
import { useJsonStore } from './store/useJsonStore';
import { useCallback, useEffect, useState } from 'react';
import { astToJson, jsonToAst } from './utils/parser';
import { useFileIO } from './hooks/useFileIO';

// Temporary sample data loading
const SAMPLE_JSON = {
  project: "VisualJSON",
  version: "1.0.0",
  features: ["AST", "Custom UI", "Virtualization"],
  settings: {
    theme: "light",
    autoSave: true
  }
};

const AUTOSAVE_KEY = 'visualjson-autosave-v1';
const AUTOSAVE_TS_KEY = 'visualjson-autosave-ts';

interface AutosaveSnapshot {
  version: 1;
  fileName: string;
  json: unknown;
  savedAt: number;
}

function App() {
  const document = useJsonStore((state) => state.document);
  const setDocumentWithMeta = useJsonStore((state) => state.setDocumentWithMeta);
  const currentFileName = useJsonStore((state) => state.currentFileName);
  const isDirty = useJsonStore((state) => state.isDirty);
  const theme = useJsonStore((state) => state.theme);
  const setTheme = useJsonStore((state) => state.setTheme);
  const { handlePaste, handleDrop, handleDragOver } = useFileIO();
  const [autosaveSnapshot, setAutosaveSnapshot] = useState<AutosaveSnapshot | null>(null);

  const loadSampleDocument = useCallback(() => {
    const ast = jsonToAst(SAMPLE_JSON);
    setDocumentWithMeta(ast, 'untitled.json', true);
  }, [setDocumentWithMeta]);

  // Initialize document from autosave or sample.
  useEffect(() => {
    const rawAutosave = window.localStorage.getItem(AUTOSAVE_KEY);
    if (rawAutosave) {
      try {
        const parsed = JSON.parse(rawAutosave) as Partial<AutosaveSnapshot>;
        if (parsed.version === 1 && typeof parsed.savedAt === 'number' && parsed.json !== undefined) {
          setAutosaveSnapshot({
            version: 1,
            fileName: typeof parsed.fileName === 'string' ? parsed.fileName : 'untitled.json',
            json: parsed.json,
            savedAt: parsed.savedAt
          });
          return;
        }
      } catch (err) {
        console.warn('Failed to parse autosave snapshot, clearing it.', err);
      }

      window.localStorage.removeItem(AUTOSAVE_KEY);
      window.localStorage.removeItem(AUTOSAVE_TS_KEY);
    }

    loadSampleDocument();
  }, [loadSampleDocument]);

  useEffect(() => {
    window.document.title = `VisualJSON - ${currentFileName}`;
  }, [currentFileName]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('visualjson-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    }
  }, [setTheme]);

  useEffect(() => {
    window.document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('visualjson-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!document || !isDirty) return;

    const timeoutId = window.setTimeout(() => {
      try {
        const snapshot: AutosaveSnapshot = {
          version: 1,
          fileName: currentFileName || 'untitled.json',
          json: astToJson(document),
          savedAt: Date.now()
        };
        window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
        window.localStorage.setItem(AUTOSAVE_TS_KEY, String(snapshot.savedAt));
      } catch (err) {
        console.warn('Failed to write autosave snapshot.', err);
      }
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [document, currentFileName, isDirty]);

  const handleRecoverAutosave = useCallback(() => {
    if (!autosaveSnapshot) return;

    try {
      const ast = jsonToAst(autosaveSnapshot.json as Parameters<typeof jsonToAst>[0]);
      setDocumentWithMeta(ast, autosaveSnapshot.fileName || 'untitled.json', false);
    } catch (err) {
      console.error('Failed to recover autosave snapshot.', err);
      alert('Autosave recovery failed. Loading sample document instead.');
      loadSampleDocument();
    } finally {
      window.localStorage.removeItem(AUTOSAVE_KEY);
      window.localStorage.removeItem(AUTOSAVE_TS_KEY);
      setAutosaveSnapshot(null);
    }
  }, [autosaveSnapshot, loadSampleDocument, setDocumentWithMeta]);

  const handleDiscardAutosave = useCallback(() => {
    window.localStorage.removeItem(AUTOSAVE_KEY);
    window.localStorage.removeItem(AUTOSAVE_TS_KEY);
    setAutosaveSnapshot(null);
    loadSampleDocument();
  }, [loadSampleDocument]);

  useEffect(() => {
    const listener: EventListener = (event) => {
      handlePaste(event as ClipboardEvent);
    };

    window.addEventListener('paste', listener);
    return () => window.removeEventListener('paste', listener);
  }, [handlePaste]);

  return (
    <div
      className="h-full flex flex-col font-sans text-slate-900 bg-slate-100 dark:bg-slate-900 dark:text-slate-100 relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Tree Explorer */}
        <div className="w-1/3 border-r border-slate-200 bg-white flex flex-col dark:border-slate-700 dark:bg-slate-800">
          <div className="p-2 border-b border-slate-100 font-medium text-sm text-slate-600 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Explorer</div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <TreeExplorer />
          </div>
        </div>

        {/* Right Pane: Detail Editor */}
        <div className="flex-1 bg-slate-50 flex flex-col dark:bg-slate-900">
          <div className="p-2 border-b border-slate-200 font-medium text-sm text-slate-600 bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Editor</div>
          <div className="flex-1 p-4 overflow-auto">
            <DetailEditor />
          </div>
        </div>
      </div>

      <StatusBar />

      {autosaveSnapshot && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Autosave Recovery</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              An autosaved document was found from {new Date(autosaveSnapshot.savedAt).toLocaleString()}.
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              File: <span className="font-medium">{autosaveSnapshot.fileName || 'untitled.json'}</span>
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleDiscardAutosave}
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Discard
              </button>
              <button
                onClick={handleRecoverAutosave}
                className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Recover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
