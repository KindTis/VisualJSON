# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the app code.
- `src/components/` is organized by UI area: `layout/`, `tree/`, and `editor/`.
- `src/store/useJsonStore.ts` holds global JSON document state and undo/redo logic (Zustand).
- `src/utils/` contains parsing and ID helpers; `src/hooks/` contains reusable behavior like file I/O.
- `public/` stores static assets, `.github/workflows/deploy.yml` defines GitHub Pages deployment, and `dist/` is build output.

## Build, Test, and Development Commands
- `npm ci` installs exact dependencies from `package-lock.json`.
- `npm run dev` starts the Vite dev server.
- `npm run build` runs TypeScript project build (`tsc -b`) and outputs production assets to `dist/`.
- `npm run preview` serves the production build locally.
- `npm run lint` runs ESLint across the repository.

## Coding Style & Naming Conventions
- Use TypeScript with React function components and hooks.
- Use `PascalCase` for component files (`TreeExplorer.tsx`), `camelCase` for variables/functions, and `useXxx` naming for hooks/stores.
- Prefer single quotes in TS/TSX; keep formatting consistent with the file you are editing to avoid unrelated diffs.
- Keep components focused and colocate feature logic in the relevant folder (`tree`, `editor`, `layout`, `store`, `utils`).

## Testing Guidelines
- Run unit tests with `npm test` (or `npm run test:watch` during development).
- Any new feature must include or update unit tests that cover the new behavior.
- Every feature change must be verified before merge by running tests (`npm test`) and required quality checks (`npm run lint`, `npm run build`).
- Minimum validation for changes: `npm run lint` and `npm run build` must pass.
- For behavior changes, manually verify key flows: load/paste JSON, tree navigation, edit operations, search, and undo/redo.
- If you introduce tests, use `*.test.ts`/`*.test.tsx` naming and place them near the feature or under `src/__tests__/`.

## Commit & Pull Request Guidelines
- Keep commit subjects short and imperative (examples from history: `Save as dialog + title sync`, `feat: initial implementation...`).
- Prefer clear scope-first messages, optionally with Conventional Commit prefixes (`feat:`, `fix:`, `chore:`).
- PRs should include: summary, reason for change, verification steps, and screenshots/GIFs for UI updates.
- Link related issues and ensure deployment-impacting changes still build cleanly for GitHub Pages.

## Agent-Specific Instructions
- 답변은 항상 사용자의 언어인 한국어로 답변을 해야 합니다.

## Engineering Execution Principles
아래 원칙을 따라야 합니다.

### 1. 구현 전에 사고
- 가정은 명시하고, 불확실하면 질문합니다.
- 해석이 여러 개인 요구사항은 선택지를 먼저 제시합니다.
- 더 단순한 대안이 있으면 먼저 제안합니다.
- 모호한 상태에서 임의 구현하지 않습니다.

### 2. 단순성 우선
- 요청된 범위만 구현하고, 추측성 기능은 추가하지 않습니다.
- 단일 사용 코드에 불필요한 추상화를 만들지 않습니다.
- 요청되지 않은 확장성/설정성은 도입하지 않습니다.
- 과한 코드가 되면 더 작은 구현으로 다시 정리합니다.

### 3. 외과적 변경
- 요청과 직접 관련된 파일/라인만 수정합니다.
- 인접 코드의 임의 리팩터링/포맷 변경은 하지 않습니다.
- 기존 스타일을 우선 따릅니다.
- 변경으로 인해 생긴 미사용 코드는 정리하되, 기존 레거시 정리는 요청 시에만 수행합니다.

### 4. 목표 기반 실행
- 작업을 검증 가능한 성공 조건으로 변환합니다.
- 버그 수정은 재현/검증 기준(테스트 또는 명시적 확인 절차)과 함께 진행합니다.
- 다단계 작업은 단계별 검증 항목을 포함해 수행합니다.
