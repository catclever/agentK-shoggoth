import type { FileSystemTree } from '@webcontainer/api';
import { todoAppFiles } from '../files';

export async function loadProject(projectName: string): Promise<FileSystemTree> {
  if (projectName === 'todo-app') {
    return todoAppFiles;
  }

  // 1. Load App Files
  const appModules = import.meta.glob('../../../apps/**/*', { query: '?raw', import: 'default', eager: true });
  const coreModules = import.meta.glob('../../../core/**/*', { query: '?raw', import: 'default', eager: true });
  
  console.log('[ProjectLoader] Loading project:', projectName);
  console.log('[ProjectLoader] Found app modules:', Object.keys(appModules).length);
  console.log('[ProjectLoader] Found core modules:', Object.keys(coreModules).length);
  
  const tree: FileSystemTree = {};

  // Helper to add to tree
  const addToTree = (basePath: string, content: string, targetPrefix: string = '') => {
    const parts = (targetPrefix + basePath).split('/');
    let current = tree;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue; // Skip empty parts
      
      const isFile = i === parts.length - 1;
      
      if (isFile) {
        current[part] = {
          file: { contents: content }
        };
      } else {
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = (current[part] as any).directory;
      }
    }
  };

  // Process App Files
  for (const path in appModules) {
    const prefix = `../../../apps/${projectName}/`;
    if (path.startsWith(prefix)) {
      const relativePath = path.substring(prefix.length);
      let content = appModules[path] as string;

      // Rewrite package.json dependencies for WebContainer environment
      if (relativePath === 'package.json') {
        try {
          const pkg = JSON.parse(content);
          if (pkg.dependencies && pkg.dependencies['@agent-k/core']) {
            pkg.dependencies['@agent-k/core'] = 'file:./core';
            content = JSON.stringify(pkg, null, 2);
          }
        } catch (e) {
          console.error('Failed to parse package.json', e);
        }
      }

      addToTree(relativePath, content);
    }
  }

  // Process Core Files (Mount at core/)
  for (const path in coreModules) {
    const prefix = `../../../core/`;
    if (path.startsWith(prefix)) {
      const relativePath = path.substring(prefix.length);
      addToTree(relativePath, coreModules[path] as string, 'core/');
    }
  }

  // Inject Interceptor (From Eye, theoretically)
  // For now, we manually inject it here, but in the future, this should come from the Eye package
  // We need to import INTERCEPTOR_SCRIPT from '@agent-k/eye' but we are in Bone.
  // Since we are mocking the loader for now, I will hardcode the injection or assume Eye is available.
  // Actually, projectLoader runs in the Browser (Bone), so it CAN import from @agent-k/eye if it's exported.
  
  // Dynamic Injection Logic
  // 1. Add interceptor.js
  tree['interceptor.js'] = {
    file: {
      contents: `
(function() {
  const sendError = (error) => {
    window.parent.postMessage({ type: 'RUNTIME_ERROR', error: { message: error.message || String(error), stack: error.stack } }, '*');
  };
  window.onerror = (msg, src, l, c, err) => sendError(err || { message: msg });
  window.addEventListener('unhandledrejection', e => sendError(e.reason));
  const _log = console.error;
  console.error = (...args) => {
    _log(...args);
    sendError({ message: args.join(' ') });
  };
})();
      `
    }
  };

  // 2. Inject <script> into index.html
  if (tree['index.html'] && 'file' in tree['index.html']) {
    const indexHtml = (tree['index.html'] as any).file.contents as string;
    if (!indexHtml.includes('interceptor.js')) {
      (tree['index.html'] as any).file.contents = indexHtml.replace(
        '<head>',
        '<head>\n    <script src="/interceptor.js"></script>'
      );
    }
  }
  
  return tree;
}
