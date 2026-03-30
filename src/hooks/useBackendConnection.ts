import { useState, useEffect } from 'react';

// Maps project names to their expected local dev server ports
// Since demo-app usually occupies 5174 when shoggoth takes 5173
const APP_PORTS: Record<string, string> = {
  'demo-app': '5174',
  'todo-app': '5175'
};

export function useBackendConnection(projectName: string, terminal: any) {
  const [serverUrl, setServerUrl] = useState<string>('');
  const [isExternal, setIsExternal] = useState<boolean>(false);
  const [externalPort, setExternalPort] = useState<string | null>(null);
  
  useEffect(() => {
    // 1. Establish the connection URL to the local dev server
    // Check if the user explicitly provided a target port in the Shoggoth URL (e.g. ?port=8080)
    const urlParams = new URLSearchParams(window.location.search);
    const customPort = urlParams.get('port');
    
    if (customPort) {
      setIsExternal(true);
      setExternalPort(customPort);
      setServerUrl(`http://localhost:${customPort}`);
      if (terminal) {
        terminal.write(`\\r\\n[Agent K Bridge] Connected to EXTERNAL environment on port: ${customPort}\\r\\n`);
      }
    } else {
      setIsExternal(false);
      setExternalPort(null);
      const port = APP_PORTS[projectName] || '5174';
      setServerUrl(`http://localhost:${port}`);
      if (terminal) {
        terminal.write(`\\r\\n[Agent K Bridge] Connected to internal workspace app: ${projectName}\\r\\n`);
      }
    }

    // 2. Here we could hook up a WebSocket to receive terminal logs from 
    // the local dev server, but for Phase 1 we just assume it's running.

  }, [projectName, terminal]);

  return { serverUrl, isExternal, externalPort };
}
