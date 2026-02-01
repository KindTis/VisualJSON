# VisualJSON

VisualJSON is a modern, high-performance visual JSON editor built with React and TypeScript. It transforms raw JSON into an interactive, manageable tree structure with powerful editing capabilities.

## ✨ Key Features

- **🚀 AST-Based Core**: Internally parses JSON into an Abstract Syntax Tree (AST) for precise manipulation and state management.
- **🌳 Virtualized Tree Explorer**: Handles large JSON files with ease using `react-window` for efficient list rendering.
- **📝 Context-Aware Editor**: Intelligent detail editor that adapts based on the type of selected node (object, array, or primitive).
- **🔄 Full Undo/Redo**: Robust history management for all mutations (value updates, adding/deleting nodes, renaming keys).
- **🔍 Smart Search**: Instant search through keys and values with auto-expansion of matching paths.
- **📥 Drag & Drop / Paste**: Easily load JSON data by dropping files or pasting content directly into the app.

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite](https://vitejs.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Components**: [react-window](https://github.com/bvaughn/react-window) for virtualization.

## 🚀 Getting Started

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd VisualJSON
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## 📖 Application Structure

- `src/store/useJsonStore.ts`: Central state management and business logic for JSON manipulation.
- `src/utils/parser.ts`: Utility for converting between raw JSON and our internal AST format.
- `src/components/tree/`: Components for the virtualized tree navigation.
- `src/components/editor/`: Components for viewing and editing node details.
- `src/hooks/useFileIO.ts`: Handles file uploads, drag-and-drop, and paste events.

## 📝 License

This project is licensed under the MIT License.

