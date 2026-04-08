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
               try {
                 activeChild.kill('SIGTERM');
               } catch(e) {}
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
                  try {
                    activeChild.kill('SIGTERM');
                  } catch(e) {}
                }
                
                outputBuffer = '';
                const targetCwd = path.resolve(__dirname, '../apps', projectName);
                
                broadcast(`[Orchestrator] Launching npm run dev in ${targetCwd}...\\r\\n`);
                
                // Use cross-platform npm executable name without shell wrapping.
                // This ensures npm resolves hoisted monorepo bins while keeping perfect 1-to-1 signal forwarding.
                const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
                activeChild = spawn(npmCmd, ['run', 'dev'], { 
                  cwd: targetCwd
                });
                
                // Catch raw spawn errors to avoid silent crashes
                activeChild.on('error', (err: any) => {
                  broadcast(`\\r\\n[Orchestrator Error] Failed to start vite: ${err.message}\\r\\n`);
                  if (!portResolved) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err.message }));
                  }
                });

                let portResolved = false;

                activeChild.stdout?.on('data', (data) => {
                  const text = data.toString();
                  // Transcribe cleanly for xterm
                  broadcast(text.replace(/\\n/g, '\\r\\n'));
                  
                  if (!portResolved) {
                    outputBuffer += text;
                    // Match Vite's output:   ➜  Local:   http://localhost:5174/ or 127.0.0.1
                    const match = outputBuffer.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
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
    watch: {
      // Prevent Shoggoth IDE from auto-reloading its own DOM when the target app's source code is updated via Tentacles
      ignored: ['**/apps/**']
    }
  }
})
