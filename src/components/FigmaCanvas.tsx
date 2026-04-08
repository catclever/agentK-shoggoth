import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FigmaAtoms } from '@agent-k/atoms';

export const FigmaCanvas: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [fileId, setFileId] = useState<string>(searchParams.get('fileId') || '');
  const [token, setToken] = useState<string>(searchParams.get('token') || '');
  
  const [loading, setLoading] = useState(false);
  const [figmaDocument, setFigmaDocument] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchFigma = async (targetFileId: string, targetToken: string) => {
    if (!targetFileId || !targetToken) {
      setErrorMsg("Please provide both File ID and Access Token");
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    setFigmaDocument(null);

    setSearchParams({ fileId: targetFileId, token: targetToken }, { replace: true });

    try {
      const response = await fetch(`https://api.figma.com/v1/files/${targetFileId}`, {
        headers: {
          'X-Figma-Token': targetToken
        }
      });

      if (!response.ok) {
        throw new Error(`Figma API Request Failed: ${response.statusText}`);
      }

      const json = await response.json();
      setFigmaDocument(json.document);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to fetch from Figma");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialFileId = searchParams.get('fileId');
    const initialToken = searchParams.get('token');
    if (initialFileId && initialToken) {
      fetchFigma(initialFileId, initialToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-5 w-full min-h-screen overflow-y-auto bg-gray-900 text-white flex flex-col">
      <div className="mb-5 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold">AI Figma Renderer Canvas</h3>
        </div>
        <div className="p-4 flex gap-4 items-center">
          <input 
            className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            placeholder="Figma File Code (e.g., uNxA... from the URL)" 
            value={fileId}
            onChange={(e) => setFileId(e.target.value)}
          />
          <input 
            className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            placeholder="Figma Personal Access Token" 
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 transition-colors"
            onClick={() => fetchFigma(fileId, token)} 
            disabled={loading}
          >
            {loading ? 'Fetching...' : 'Fetch & Render'}
          </button>
        </div>
        {errorMsg && <div className="px-4 pb-4 text-red-500 text-sm">{errorMsg}</div>}
      </div>

      <div className="mt-5 w-full bg-white text-black rounded-lg overflow-hidden flex-1 relative min-h-[600px] border border-gray-700 shadow-2xl">
        {loading ? (
          <div className="flex justify-center items-center h-full min-h-[400px]">
            <span className="text-gray-500 animate-pulse text-lg tracking-widest">Downloading and Parsing Figma JSON...</span>
          </div>
        ) : figmaDocument ? (
          <div className="w-full h-full">
            {FigmaAtoms.renderFigmaNode(figmaDocument)}
          </div>
        ) : (
          <div className="flex justify-center items-center h-full min-h-[400px]">
            <span className="text-gray-400">Awaiting Figma Payload...</span>
          </div>
        )}
      </div>
    </div>
  );
};
