import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'agent-k-local-proxy',
      configureServer(server) {
        // Express-like middleware for writing files directly to local disk
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url === '/api/fs/write') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const { filepath, content } = JSON.parse(body);
                // filepath comes mapped from project workspace root, e.g. "apps/demo-app/src/pages/home.json"
                const absolutePath = path.resolve(__dirname, '../', filepath);
                fs.writeFileSync(absolutePath, content, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@agent-k/tentacles': path.resolve(__dirname, '../libs/tentacles/src/index.ts'),
      '@agent-k/gladius': path.resolve(__dirname, '../libs/gladius/src/index.ts'),
      '@agent-k/eyes': path.resolve(__dirname, '../libs/eyes/src/index.ts'),
      '@agent-k/azathoth': path.resolve(__dirname, '../libs/azathoth/src/index.ts'),
    }
  },
  server: {
    fs: {
      allow: ['..']
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  }
})
