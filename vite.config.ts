import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

import { spawn, ChildProcess } from 'child_process';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'agent-k-local-proxy',
      configureServer(server) {
        let activeChild: ChildProcess | null = null;
        let sseClients: any[] = [];
        let outputBuffer = ''; // To reliably match the Vite port regex
        
        const broadcast = (data: string) => {
          sseClients.forEach(res => {
            try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch(e){}
          });
        };

        server.middlewares.use((req: any, res: any, next) => {
          // --- EXISTING FS WRITE ---
          if (req.method === 'POST' && req.url === '/api/fs/write') {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const { filepath, content } = JSON.parse(body);
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

          // --- PROCESS ORCHESTRATOR ---
          
          if (req.method === 'GET' && req.url === '/api/process/stream') {
             res.writeHead(200, {
               'Content-Type': 'text/event-stream',
               'Cache-Control': 'no-cache',
               'Connection': 'keep-alive',
               // Required for CORS & WebContainer headers proxying
               'Cross-Origin-Embedder-Policy': 'credentialless'
             });
             sseClients.push(res);
             req.on('close', () => {
                sseClients = sseClients.filter(c => c !== res);
             });
             return;
          }

          if (req.method === 'POST' && req.url === '/api/process/stop') {
             if (activeChild) {
               activeChild.kill('SIGTERM');
               activeChild = null;
               broadcast('[Orchestrator] Target Process Terminated.\\r\\n');
             }
             res.setHeader('Content-Type', 'application/json');
             res.end(JSON.stringify({ status: 'stopped' }));
             return;
          }

          if (req.method === 'POST' && req.url === '/api/process/start') {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const { projectName } = JSON.parse(body); // e.g. "demo-app"
                if (activeChild) {
                  activeChild.kill('SIGTERM');
                }
                
                outputBuffer = '';
                const targetCwd = path.resolve(__dirname, '../apps', projectName);
                
                broadcast(`[Orchestrator] Launching npm run dev in ${targetCwd}...\\r\\n`);
                
                activeChild = spawn('npm', ['run', 'dev'], { 
                  cwd: targetCwd,
                  shell: true // Important for cross-platform npm resolving
                });

                let portResolved = false;

                activeChild.stdout?.on('data', (data) => {
                  const text = data.toString();
                  // Transcribe cleanly for xterm
                  broadcast(text.replace(/\\n/g, '\\r\\n'));
                  
                  if (!portResolved) {
                    outputBuffer += text;
                    // Match Vite's output:   ➜  Local:   http://localhost:5174/
                    const match = outputBuffer.match(/http:\/\/localhost:(\\d+)/);
                    if (match) {
                      portResolved = true;
                      const port = match[1];
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ success: true, port }));
                    }
                  }
                });

                activeChild.stderr?.on('data', (data) => {
                   const text = data.toString();
                   broadcast(`\\x1b[31m${text.replace(/\\n/g, '\\r\\n')}\\x1b[0m`);
                });

                activeChild.on('close', (code) => {
                  broadcast(`[Orchestrator] Process exited with code ${code}\\r\\n`);
                  if (!portResolved) {
                     res.statusCode = 500;
                     res.end(JSON.stringify({ error: "Process exited before resolving port." }));
                  }
                  activeChild = null;
                });

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
