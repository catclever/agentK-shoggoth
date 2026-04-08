import React, { useState, useEffect, Suspense } from 'react'
import { Artboard, TentaclesOverlay } from '@agent-k/tentacles' // Core UI component, statically bundled
import { ShoggothKernelProvider } from '@agent-k/core'
import { useBackendConnection } from './hooks/useBackendConnection'
import { loadProject } from './utils/projectLoader'
import shoggothSpec from './shoggoth_workspace.json'
import type { ComponentInstance } from './types'
import { IdeShell } from './components/IdeShell'
import './App.css'

import { GladiusTerminal } from '@agent-k/gladius';
import { AIPanel } from '@agent-k/eyes';
import { Azathoth } from '@agent-k/azathoth';

// Capability Filter System 
// In a real system, the backend reports these capabilities upon connection.
const BACKEND_CAPABILITIES = ['terminal', 'vision', 'canvas', 'schema'];

const EXTENSION_CAPABILITIES: Record<string, string[]> = {
  'GladiusConsole': ['terminal'],
  'EyeAIPanel': ['vision'],
  'AzathothRegistry': ['schema'],
  'TentaclesOverlay': ['canvas']
};

// Check if a component type's dependencies are fully met by the backend
const checkCapabilities = (type: string, activeCapabilities: string[]) => {
  const requirements = EXTENSION_CAPABILITIES[type];
  if (!requirements) return false;
  return requirements.every(req => activeCapabilities.includes(req));
};

import { Routes, Route } from 'react-router-dom'
import { FigmaCanvas } from './components/FigmaCanvas'

// Mock Data for Canvas (Ideally this comes from the loaded project's JSON)
const INITIAL_COMPONENTS: ComponentInstance[] = [];

function IdeWorkspace() {
  const [components, setComponents] = useState<ComponentInstance[]>(INITIAL_COMPONENTS);
  const [scale, setScale] = useState(1);
  const [projectName, setProjectName] = useState('demo-app');

  const [term, setTerm] = useState<any>(null);
  const { serverUrl, isExternal, externalPort, bootStatus, startTargetProcess, stopTargetProcess } = useBackendConnection(projectName, term);
  
  // Load Project
  useEffect(() => {
    loadProject(projectName).then((tree) => {
       // Parse home.json for initial components
       // Path: apps/demo-app/src/pages/home.json -> mapped to root 'src/pages/home.json' in loader?
       // projectLoader maps `apps/demo-app/` to ``. 
       // So we look for src/pages/home.json in the tree.
       
       try {
         // This traversal depends on loader structure.
         // tree['src']['directory']['pages']['directory']['home.json']['file']['contents']
         const src = (tree['src'] as any).directory;
         const pages = (src['pages'] as any).directory;
         const homeJson = (pages['home.json'] as any).file.contents;
         
         const parsed = JSON.parse(homeJson);
         if (parsed.components) {
           // Flatten canvas props for internal use
           const flattened = parsed.components.map((c: any) => ({
             ...c,
             x: c.canvas?.x || 0,
             y: c.canvas?.y || 0,
             width: c.canvas?.width || 0,
             height: c.canvas?.height || 0,
             rotation: c.canvas?.rotation || 0,
           }));
           setComponents(flattened);
         }
       } catch (e) {
         console.warn('Failed to parse initial home.json', e);
       }
    });
  }, [projectName]);

  const handleUpdate = (id: string, updates: Partial<ComponentInstance>) => {
    setComponents((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      
      const pageSpec = {
        id: "page-home", 
        name: "Home Page",
        components: next.map(c => {
          const { x, y, width, height, rotation, ...rest } = c;
          return {
            ...rest,
            canvas: { x, y, width, height, rotation }
          };
        })
      };
      
      // Write back to Local FileSystem via Dev Server Proxy
      fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: `apps/${projectName}/src/pages/home.json`,
          content: JSON.stringify(pageSpec, null, 2)
        })
      }).catch(err => console.error('Failed to write updates', err));
      
      return next;
    });
  };

  // Listen for runtime errors from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'RUNTIME_ERROR') {
        const { error } = event.data;
        if (term) {
          term.write(`\\r\\n\\x1b[31m[Runtime Error] ${error.message}\\x1b[0m\\r\\n`);
          if (error.stack) {
             const stackLines = error.stack.split('\\n').map((line: string) => `  ${line}`).join('\\r\\n');
             term.write(`\\x1b[90m${stackLines}\\x1b[0m\\r\\n`);
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [term]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Extract tools from filtered shoggothSpec
  const activePlugins = shoggothSpec.components.filter(c => checkCapabilities(c.type, BACKEND_CAPABILITIES));
  const hasGladius = activePlugins.some(c => c.type === 'GladiusConsole');
  const hasAzathoth = activePlugins.some(c => c.type === 'AzathothRegistry');
  const hasEye = activePlugins.some(c => c.type === 'EyeAIPanel');
  const hasTentacles = activePlugins.some(c => c.type === 'TentaclesOverlay');

  // The Right Panel Properties
  const rightPanelTop = (
    <div className="text-neutral-400 text-sm">
       {selectedId ? (
         <div>
            <div className="font-mono text-blue-400 mb-2">ID: {selectedId}</div>
            <div className="text-neutral-500">More properties will be available here when wired.</div>
         </div>
       ) : (
         <div>Select an element to view properties.</div>
       )}
    </div>
  );

  // Azathoth
  const rightPanelBottomSlot = hasAzathoth ? (
    <div className="flex-1 overflow-hidden">
       <Suspense fallback={<div className="p-4 text-xs text-neutral-500">Loading Azathoth Module...</div>}>
         <Azathoth />
       </Suspense>
    </div>
  ) : null;

  // Gladius
  const topLeftTerminalSlot = hasGladius ? (
    <div className="w-full h-full bg-black">
      <Suspense fallback={<div className="p-4 text-xs text-neutral-500">Initializing Terminal Sandbox...</div>}>
        <GladiusTerminal onTerminalReady={setTerm} />
      </Suspense>
    </div>
  ) : null;

  // Contextual Eye
  // Locate the selected component bounds perfectly and render Eye floating slightly right of it.
  const contextualEyeSlot = (hasEye && selectedId) ? (
    <div 
      className="absolute z-50 transition-all duration-300 pointer-events-auto"
      style={{
         // We guess position by locating it in components array (Tentacles overlays this).
         // A more advanced engine uses React Refs, but using absolute canvas x/y works perfectly as Artboard does not scale it immediately.
         // Let's attach an abstract popup.
         top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      }}
    >
       <div id={`eye-portal-anchor-${selectedId}`} />
    </div>
  ) : null;

  const canvasArea = (
    <Artboard scale={scale} onScaleChange={setScale} panning={false} autoResize={true}>
      <div className="absolute inset-0 bg-[#e4e4e7] dark:bg-[#18181b]" onClick={() => setSelectedId(null)}>
         {serverUrl && !isExternal ? (
           <iframe 
             src={serverUrl} 
             className="w-full h-full border-none opacity-90 pointer-events-none"
             title="App Preview"
           />
         ) : serverUrl && isExternal ? (
           <div className="w-full h-full flex items-center justify-center text-neutral-500 bg-neutral-900 border-none pointer-events-none">
              <span className="animate-pulse">Loading External Canvas Preview...</span>
           </div>
         ) : (
           <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 pointer-events-none">
             <span className="animate-pulse font-mono tracking-widest text-lg">WAITING FOR CORE</span>
             <span className="text-xs">Establish local dev backend.</span>
           </div>
         )}
      </div>

      {/* Native Interception Layer for Selections */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {components.map(component => {
           const isSelected = selectedId === component.id;
           const x = component.x ?? 0;
           const y = component.y ?? 0;
           const width = component.width ?? 0;
           const height = component.height ?? 0;
           const rotation = component.rotation ?? 0;
           
           return (
             <div 
               key={component.id}
               id={`overlay-${component.id}`}
               onClick={(e) => { e.stopPropagation(); setSelectedId(component.id); }}
               className={`absolute pointer-events-auto transition-shadow duration-200 select-none touch-none ${
                 isSelected 
                   ? (hasTentacles ? 'bg-transparent border-transparent z-40' : 'z-50 border-2 border-blue-500 bg-blue-500/10') 
                   : 'hover:ring-1 hover:ring-blue-300 z-10 border border-transparent hover:border-black/10 dark:hover:border-white/20'
               }`}
               style={{
                 left: x, top: y, width, height, position: 'absolute',
                 transform: `rotate(${rotation || 0}deg)`,
                 cursor: 'pointer'
               }}
             />
           );
        })}
         {hasTentacles && (
           <TentaclesOverlay 
             targetId={selectedId} 
             onUpdate={handleUpdate}
             scale={scale}
           />
         )}
      </div>

      {/* Floating Contextual Eye Layer over the canvas */}
      {hasEye && selectedId && (
        components.map(c => {
           if (c.id === selectedId) {
              // Position the 'Eye' popup strictly to the right side of the component wrapper.
              const cx = (c.x ?? 0) + (c.width ?? 0) + 24;
              const cy = (c.y ?? 0);
              return (
                 <div key="eye-popup" className="absolute z-50 w-[360px] h-[400px] shadow-[0_0_40px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 transition-all duration-150 ease-out" 
                      style={{ left: cx, top: cy }}>
                    <div className="h-8 bg-zinc-800 border-b border-black/50 flex items-center justify-between px-4 font-mono text-[10px]">
                       <span className="text-blue-400">[AGENT F] ATTACHED TO: {c.type}</span>
                       <button onClick={() => setSelectedId(null)} className="text-neutral-500 hover:text-white transition-colors">
                         <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>
                    </div>
                    <div className="w-full h-[calc(100%-2rem)] bg-black/80">
                       <Suspense fallback={<div className="p-4 pt-10 text-center text-xs text-blue-500">Loading Visual Copilot...</div>}>
                         <AIPanel />
                       </Suspense>
                    </div>
                 </div>
              );
           }
           return null;
        })
      )}
    </Artboard>
  );

  return (
    <ShoggothKernelProvider>
      <IdeShell 
        projectName={projectName}
        setProjectName={setProjectName}
        serverUrl={serverUrl}
        isExternal={isExternal}
        externalPort={externalPort}
        bootStatus={bootStatus}
        startTargetProcess={startTargetProcess}
        stopTargetProcess={stopTargetProcess}
        componentCount={components.length}
        rightPanelTop={rightPanelTop}
        rightPanelBottomSlot={rightPanelBottomSlot}
        topLeftTerminalSlot={topLeftTerminalSlot}
        canvasArea={canvasArea}
        contextualEyeSlot={contextualEyeSlot}
      />
    </ShoggothKernelProvider>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<IdeWorkspace />} />
      <Route path="/figma" element={<FigmaCanvas />} />
    </Routes>
  );
}

export default App
