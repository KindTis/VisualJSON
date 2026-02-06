import { TopBar } from './components/layout/TopBar';
import { StatusBar } from './components/layout/StatusBar';
import { TreeExplorer } from './components/tree/TreeExplorer';
import { DetailEditor } from './components/editor/DetailEditor';
import { useJsonStore } from './store/useJsonStore';
import { useEffect } from 'react';
import { jsonToAst } from './utils/parser';
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

function App() {
  const setDocument = useJsonStore((state) => state.setDocument);
  const currentFileName = useJsonStore((state) => state.currentFileName);
  const { handlePaste, handleDrop, handleDragOver } = useFileIO();

  // Load sample data on mount (for dev)
  useEffect(() => {
    const ast = jsonToAst(SAMPLE_JSON);
    setDocument(ast);
  }, [setDocument]);

  useEffect(() => {
    window.document.title = `VisualJSON - ${currentFileName}`;
  }, [currentFileName]);

  useEffect(() => {
    const listener: EventListener = (event) => {
      handlePaste(event as ClipboardEvent);
    };

    window.addEventListener('paste', listener);
    return () => window.removeEventListener('paste', listener);
  }, [handlePaste]);

  return (
    <div
      className="h-full flex flex-col font-sans text-slate-900"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Tree Explorer */}
        <div className="w-1/3 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-2 border-b border-slate-100 font-medium text-sm text-slate-600 bg-slate-50">Explorer</div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <TreeExplorer />
          </div>
        </div>

        {/* Right Pane: Detail Editor */}
        <div className="flex-1 bg-slate-50 flex flex-col">
          <div className="p-2 border-b border-slate-200 font-medium text-sm text-slate-600 bg-white">Editor</div>
          <div className="flex-1 p-4 overflow-auto">
            <DetailEditor />
          </div>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}

export default App;
