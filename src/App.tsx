import { useState, useEffect } from 'react'
import { TentaclesOverlay, Artboard, DraggableWindow } from '@agent-k/tentacles'
import { AIPanel } from '@agent-k/eyes'
import { GladiusTerminal } from '@agent-k/gladius'
import { Azathoth } from '@agent-k/azathoth'
import { useBackendConnection } from './hooks/useBackendConnection'
import { loadProject } from './utils/projectLoader'
import shoggothSpec from './shoggoth_workspace.json'
import type { ComponentInstance } from './types'
import './App.css'

// Mock Data for Canvas (Ideally this comes from the loaded project's JSON)
const INITIAL_COMPONENTS: ComponentInstance[] = [];

function App() {
  const [components, setComponents] = useState<ComponentInstance[]>(INITIAL_COMPONENTS);
  const [scale, setScale] = useState(1);
  const [projectName, setProjectName] = useState('demo-app');

  const [term, setTerm] = useState<any>(null);
  const { serverUrl, isExternal, externalPort } = useBackendConnection(projectName, term);
  
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

  return (
    <div className="bone-root w-screen h-screen bg-gray-900 text-white overflow-hidden relative">
      {/* Main Workspace */}
      <div className="absolute inset-0 z-0 flex flex-col">
        {/* Header / Dock */}
        <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between z-10 relative">
          <div className="flex items-center gap-4">
            <span className="font-bold text-blue-400">Agent K Studio</span>
            {isExternal ? (
              <select className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-500 cursor-not-allowed" disabled>
                <option>External Instance (Port: {externalPort})</option>
              </select>
            ) : (
              <select 
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              >
                <option value="demo-app">apps/demo-app</option>
                <option value="todo-app">apps/todo-app (Mock)</option>
              </select>
            )}
          </div>
          <div className="text-xs text-gray-500 flex gap-4">
             <span>Components: {components.length}</span>
            {serverUrl ? `Server: ${serverUrl}` : 'Booting...'}
          </div>
        </div>

        {/* Workspace Area (Canvas + Right Panel) */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Canvas Area */}
          <div className="flex-1 relative bg-gray-900">
            <Artboard scale={scale} onScaleChange={setScale} panning={false} autoResize={true}>
              {/* Layer 0: The App Renderer (Iframe) */}
              <div className="absolute inset-0 bg-white">
                 {serverUrl ? (
                   <iframe 
                     src={serverUrl} 
                     className="w-full h-full border-none"
                     title="App Preview"
                   />
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                     <span className="animate-pulse">Waiting for Local Server (npm run dev:{projectName})...</span>
                     <span className="text-xs">Make sure you have started the local backend in a separate terminal.</span>
                   </div>
                 )}
              </div>

              {/* Layer 1: The Tentacles Overlay (Plugin) */}
              <TentaclesOverlay 
                components={components} 
                scale={scale} 
                onUpdate={handleUpdate}
                onSelect={(id) => console.log('Selected:', id)}
              />
            </Artboard>
          </div>

          {/* Right Panel (Properties / AI) */}
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col z-40">
            <div className="p-4 border-b border-gray-700 font-bold text-gray-300">
              Properties
            </div>
            <div className="p-4 text-gray-400 text-sm">
              Select an element to view properties.
            </div>
            
            <div className="mt-auto p-4 border-t border-gray-700">
               <div className="font-bold text-gray-300 mb-2">AI Assistant</div>
               <div className="h-32 bg-gray-900 rounded border border-gray-700 p-2 text-xs text-green-400 font-mono overflow-y-auto">
                 {term ? 'Terminal Ready' : 'Initializing...'}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layer 2: The Eye (Overlays - Driven by JSON Bootstrap) */}
      
      {shoggothSpec.components.map((c: any) => {
        if (c.type === 'GladiusConsole') {
          return (
            <DraggableWindow 
              key={c.id}
              title={c.props.title || "GLADIUS CONSOLE"} 
              initialX={c.canvas.x} 
              initialY={c.canvas.y}
              initialWidth={c.canvas.width}
              initialHeight={c.canvas.height}
            >
              <div className="w-full h-full bg-black p-2">
                <GladiusTerminal onTerminalReady={setTerm} />
              </div>
            </DraggableWindow>
          );
        }
        if (c.type === 'AzathothRegistry') {
          return (
            <DraggableWindow 
              key={c.id}
              title={c.props.title || "AZATHOTH"} 
              initialX={c.canvas.x} 
              initialY={c.canvas.y}
              initialWidth={c.canvas.width}
              initialHeight={c.canvas.height}
            >
              <Azathoth />
            </DraggableWindow>
          );
        }
        if (c.type === 'EyeAIPanel') {
          return (
            <DraggableWindow 
              key={c.id}
              title={c.props.title || "AGENT F (EYE)"} 
              initialX={c.canvas.x} 
              initialY={c.canvas.y}
              initialWidth={c.canvas.width}
              initialHeight={c.canvas.height}
            >
              <AIPanel />
            </DraggableWindow>
          );
        }
        return null;
      })}
    </div>
  )
}

export default App
