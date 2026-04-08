import React, { useState } from 'react';
import { Terminal, Settings, Sparkles, X, Play, Square, Loader2 } from 'lucide-react';

interface IdeShellProps {
  projectName: string;
  setProjectName: (name: string) => void;
  serverUrl: string;
  isExternal: boolean;
  externalPort: string | null;
  componentCount: number;
  bootStatus: 'idle' | 'booting' | 'online';
  startTargetProcess: () => void;
  stopTargetProcess: () => void;
  
  // Slots
  rightPanelTop: React.ReactNode; // Properties
  rightPanelBottomSlot: React.ReactNode; // For Azathoth
  topLeftTerminalSlot: React.ReactNode; // For Gladius
  canvasArea: React.ReactNode; // For Artboard
  contextualEyeSlot: React.ReactNode; // For Eye
}

export const IdeShell: React.FC<IdeShellProps> = ({
  projectName, setProjectName, serverUrl, isExternal, externalPort, componentCount,
  bootStatus, startTargetProcess, stopTargetProcess,
  rightPanelTop, rightPanelBottomSlot, topLeftTerminalSlot, canvasArea, contextualEyeSlot
}) => {
  const [terminalOpen, setTerminalOpen] = useState(false);

  return (
    <div className="bone-root w-screen h-screen bg-neutral-900 text-neutral-100 overflow-hidden relative font-sans">
      
      {/* Background ambient lighting for glassmorphism */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Header */}
      <header className="h-14 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center px-4 justify-between z-30 relative select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <span className="font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Agent K Studio</span>
          </div>
          
          <div className="h-6 w-px bg-white/10 mx-2" />
          
          {isExternal ? (
            <div className="px-3 py-1 bg-white/5 border border-white/10 text-xs rounded-full text-neutral-400 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              External Instance (Port: {externalPort})
            </div>
          ) : (
            <select 
              className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-neutral-300 backdrop-blur-sm"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            >
              <option value="demo-app" className="bg-neutral-800">apps/demo-app</option>
              <option value="todo-app" className="bg-neutral-800">apps/todo-app (Mock)</option>
            </select>
          )}

          {/* Ignition Controls */}
          <div className="flex items-center gap-2 ml-2">
            {bootStatus === 'idle' && (
               <button onClick={startTargetProcess} className="flex items-center gap-1.5 px-3 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 rounded shadow-[0_0_10px_rgba(34,197,94,0.2)] transition-all text-xs font-semibold">
                  <Play className="w-3 h-3 fill-current" /> RUN
               </button>
            )}
            {bootStatus === 'booting' && (
               <button disabled className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-xs font-semibold cursor-not-allowed">
                  <Loader2 className="w-3 h-3 animate-spin" /> BOOTING...
               </button>
            )}
            {bootStatus === 'online' && (
               <button onClick={stopTargetProcess} className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 rounded shadow-[0_0_10px_rgba(239,68,68,0.2)] transition-all text-xs font-semibold">
                  <Square className="w-3 h-3 fill-current" /> STOP
               </button>
            )}
          </div>

          <div className="h-6 w-px bg-white/10 mx-2" />
          
          {/* CLI Toggle Button */}
          <button 
            onClick={() => setTerminalOpen(!terminalOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-200 border ${
              terminalOpen 
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            CLI Terminal {terminalOpen ? '(Active)' : ''}
          </button>
        </div>

        <div className="flex items-center gap-6 text-xs text-neutral-400 pr-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Components: {componentCount}
          </div>
          <div className="flex items-center gap-2">
            {bootStatus === 'online' ? (
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
            ) : bootStatus === 'booting' ? (
               <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            ) : (
               <div className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
            )}
            {bootStatus === 'online' ? `Server: ${serverUrl}` : bootStatus === 'booting' ? 'Booting process in background...' : 'Server Idle'}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 w-full h-[calc(100vh-3.5rem)] flex flex-row overflow-hidden relative z-10">
        
        {/* CLI Sliding Dropdown (Absolute Top Left over Canvas) */}
        <div 
          className={`absolute top-0 left-4 z-40 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xl rounded-b-xl border-x border-b border-white/10 bg-black/70 backdrop-blur-2xl overflow-hidden flex flex-col ${
            terminalOpen ? 'translate-y-0 opacity-100 h-[60vh] w-[800px] pointer-events-auto' : '-translate-y-full opacity-0 h-[60vh] w-[800px] pointer-events-none'
          }`}
        >
          {/* CLI Header bar */}
          <div className="h-8 bg-white/5 border-b border-white/10 flex items-center px-4 justify-between w-full shrink-0">
             <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
               <Terminal className="w-3 h-3" /> Agent K Execution Environment
             </div>
             <button onClick={() => setTerminalOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
               <X className="w-3.5 h-3.5" />
             </button>
          </div>
          <div className="flex-1 w-full overflow-hidden relative p-1">
             {topLeftTerminalSlot || (
               <div className="flex items-center justify-center h-full text-neutral-600 text-sm font-mono italic">
                 [GladiusConsole Tool is completely unmounted via JSON configuration]
               </div>
             )}
          </div>
        </div>

        {/* Center Canvas Area */}
        <div className="flex-1 relative bg-transparent overflow-hidden">
          {canvasArea}
          {contextualEyeSlot}
        </div>

        {/* Right Sidebar (Properties + Azathoth) */}
        <div className="w-80 bg-black/40 backdrop-blur-xl border-l border-white/10 flex flex-col shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.2)] z-20">
          
          {/* Properties Section (Always Native & Present) */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2 text-sm font-medium text-neutral-200 shrink-0 bg-white/5">
              <Settings className="w-4 h-4 text-neutral-400" /> Properties
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {rightPanelTop}
            </div>
          </div>
          
          {/* Azathoth Slot (Optional JSON Injection) */}
          {React.Children.count(rightPanelBottomSlot) > 0 ? (
            <div className="flex-1 flex flex-col min-h-0 border-t border-white/10 bg-black/20">
              {rightPanelBottomSlot}
            </div>
          ) : (
            <div className="h-12 border-t border-white/10 flex items-center justify-center text-xs text-neutral-600 bg-white/5 italic">
               [AzathothRegistry Tool is skipped in JSON]
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
