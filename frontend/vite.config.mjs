import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: { entry: {health:'src/main.tsx', business:'src/features/m0-03.ts',tickets:'src/features/m0-04.ts'}, formats: ['es'], fileName: (_format,name) => name==='health'?'helpdesk/health.js':name==='tickets'?'helpdesk/m0-04.js':'helpdesk/m0-03.js' },
  },
  preview: { host: '127.0.0.1', proxy: { '/api/': 'http://127.0.0.1:18090' } },
});
