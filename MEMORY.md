# MEMORY

이 파일은 VisualJSON 작업의 장기 기억(결정/규칙/중요 맥락)을 요약/정제해 보관합니다.

## 프로젝트 핵심 구조 (정제)
- 상태: `src/store/useJsonStore.ts` (Zustand)
- 파서: `src/utils/parser.ts` (`jsonToAst`, `astToJson`)
- 파일 IO: `src/hooks/useFileIO.ts` (open/save/paste/drop)
- UI 진입: `src/App.tsx` (현재는 샘플 JSON을 마운트 시 로드)
- 트리: `src/components/tree/TreeExplorer.tsx` (expandedIds 기반 flatten)
- 상세 편집: `src/components/editor/DetailEditor.tsx`

## 중요 결정/합의
- (추가 예정)

## 알려진 민감 영역
- undo/redo: 노드 추가/삭제/리네임/값 수정이 서로 얽힘. 작은 변경도 회귀 위험.
- search: 첫 결과 자동 선택/자동 expand 로직이 있어 selection/expandedIds 영향 큼.
- 파일 IO: paste/drop은 문서 교체를 유발(사용자 확인 포함).

## 운영 메모
- 일일 원본 로그: `memory/YYYY-MM-DD.md`
- 중요한 변경/합의는 일지에서 추출해 이 파일로 승격(promote).
