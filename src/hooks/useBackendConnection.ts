import { useState, useEffect, useRef } from 'react';

export type BootStatus = 'idle' | 'booting' | 'online';

export function useBackendConnection(projectName: string, terminal: any) {
  const [serverUrl, setServerUrl] = useState<string>('');
  const [isExternal, setIsExternal] = useState<boolean>(false);
  const [externalPort, setExternalPort] = useState<string | null>(null);
  const [bootStatus, setBootStatus] = useState<BootStatus>('idle');
  const eventSourceRef = useRef<EventSource | null>(null);

  // 1. Establish SSE Streams globally when hook launches and handle Terminal writing
  useEffect(() => {
    // Only connect SSE if we aren't connected yet (prevent duplicate streams on render)
    if (!eventSourceRef.current) {
      const es = new EventSource('/api/process/stream');
      
      es.onmessage = (event) => {
        try {
          const logData = JSON.parse(event.data);
          if (terminal) {
             terminal.write(logData);
          }
        } catch (e) {
          console.error("SSE parse error", e);
        }
      };

      es.onerror = () => {
         // SSE fails on boot temporarily sometimes
      };

      eventSourceRef.current = es;
    }

    return () => {
      // Intentionally leak SSE or clean up on unmount
      if (eventSourceRef.current) {
         eventSourceRef.current.close();
         eventSourceRef.current = null;
      }
    };
  }, [terminal]); // Bind strictly terminal writes once terminal is ready.

  useEffect(() => {
    // Determine if External Port exists
    const urlParams = new URLSearchParams(window.location.search);
    const customPort = urlParams.get('port');
    
    if (customPort) {
      setIsExternal(true);
      setExternalPort(customPort);
      setServerUrl(`http://localhost:${customPort}`);
      setBootStatus('online');
      if (terminal) terminal.write(`\\r\\n[Agent K] Connected via External Port\\r\\n`);
    } else {
      setIsExternal(false);
      setServerUrl(''); // Clear until started!
      setBootStatus('idle');
      if (terminal) terminal.write(`\\r\\n[Agent K] Workspace configured: ${projectName}. Awaiting ignition.\\r\\n`);
    }
  }, [projectName, terminal]);

  const startTargetProcess = async () => {
    if (isExternal) return;
    setBootStatus('booting');
    if (terminal) terminal.write(`\\r\\n[System] Initiating local dev orchestrator for: ${projectName}\\r\\n`);
    
    try {
      const res = await fetch('/api/process/start', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ projectName })
      });
      const data = await res.json();
      if (data.port) {
         setServerUrl(`http://localhost:${data.port}`);
         setBootStatus('online');
         if (terminal) terminal.write(`\\r\\n[System] Process Orchestrator locked visual proxy to port: ${data.port}\\r\\n`);
      } else {
         setBootStatus('idle');
         if (terminal) terminal.write(`\\r\\n[System Error] Failed to resolve port from orchestrator.\\r\\n`);
      }
    } catch (err: any) {
      setBootStatus('idle');
      if (terminal) terminal.write(`\\r\\n[System Error] API error: ${err.message}\\r\\n`);
    }
  };

  const stopTargetProcess = async () => {
    if (isExternal) return;
    setServerUrl('');
    setBootStatus('idle');
    try {
      await fetch('/api/process/stop', { method: 'POST' });
      if (terminal) terminal.write(`\\r\\n[System] Orchestrated process manually killed.\\r\\n`);
    } catch (e) {
       console.error("Stop error", e);
    }
  };

  return { serverUrl, isExternal, externalPort, bootStatus, startTargetProcess, stopTargetProcess };
}
