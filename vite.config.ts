import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages(프로젝트 페이지)는 기본 경로가 /<repo>/ 입니다.
  base: mode === 'production' ? '/VisualJSON/' : '/',
  build: {
    sourcemap: false,
  },
}))
