
export const todoAppFiles = {
  "index.html": {
    "file": {
      "contents": "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>Agent K Todo</title>\n    <script src=\"/interceptor.js\"></script>\n  </head>\n  <body>\n    <div id=\"root\"></div>\n    <script type=\"module\" src=\"/src/main.jsx\"></script>\n  </body>\n</html>\n"
    }
  },
  "interceptor.js": {
    "file": {
      "contents": "(function() {\n  const sendError = (error) => {\n    const errorObj = {\n      message: error.message || String(error),\n      stack: error.stack,\n      filename: error.filename,\n      lineno: error.lineno,\n      colno: error.colno\n    };\n\n    // 1. Send to Parent (Terminal)\n    window.parent.postMessage({\n      type: 'RUNTIME_ERROR',\n      error: errorObj\n    }, '*');\n  };\n\n  window.onerror = function(message, source, lineno, colno, error) {\n    sendError(error || { message, filename: source, lineno, colno });\n  };\n\n  window.addEventListener('unhandledrejection', function(event) {\n    sendError(event.reason);\n  });\n\n  const originalConsoleError = console.error;\n  console.error = function(...args) {\n    originalConsoleError.apply(console, args);\n    // Filter out HMR logs or other noise if needed\n    sendError({ message: args.map(a => String(a)).join(' '), stack: new Error().stack });\n  };\n})();\n"
    }
  },
  "package.json": {
    "file": {
      "contents": "{\n  \"name\": \"todo-app\",\n  \"type\": \"module\",\n  \"scripts\": {\n    \"dev\": \"vite\",\n    \"build\": \"vite build\"\n  },\n  \"dependencies\": {\n    \"react\": \"^18.2.0\",\n    \"react-dom\": \"^18.2.0\",\n    \"@agent-k/core\": \"file:./libs/core\"\n  },\n  \"devDependencies\": {\n    \"@vitejs/plugin-react\": \"^4.0.0\",\n    \"vite\": \"^5.0.0\"\n  }\n}"
    }
  },
  "src": {
    "directory": {
      "App.jsx": {
        "file": {
          "contents": "import React from 'react';\nimport { defineSchema, store, useList, useDispatch, z } from '@agent-k/core';\n\n// 1. Define Schema (Schema-First)\nconst TodoSchema = z.object({\n  id: z.string(),\n  title: z.string(),\n  done: z.boolean()\n});\n\nconst TodoDef = defineSchema('todos', TodoSchema, 'id');\nstore.register(TodoDef);\n\n// 2. Component\nfunction App() {\n  const { data: todos } = useList('todos');\n  const { dispatch } = useDispatch('todos');\n\n  const handleAdd = () => {\n    const title = prompt('New Todo:');\n    if (title) {\n      dispatch('create', null, {\n        id: Date.now().toString(),\n        title,\n        done: false\n      });\n    }\n  };\n\n  const handleClear = async () => {\n    if (confirm('Delete all todos?')) {\n      // Direct access to RxDB collection for bulk delete\n      const collection = store.db.collections.todos;\n      await collection.find().remove();\n    }\n  };\n\n  const toggle = (todo) => {\n    dispatch('update', todo.id, { done: !todo.done });\n  };\n\n  return (\n    <div>\n      <h1>Agent K Todo (No Backend!)</h1>\n      <div style={{ display: 'flex', gap: '10px' }}>\n        <button onClick={handleAdd}>Add Todo</button>\n        <button onClick={handleClear} style={{ background: '#ff4444', color: 'white' }}>Clear Data</button>\n        <button onClick={() => { throw new Error('Test Error from Inside!'); }} style={{ background: 'orange', color: 'white' }}>Trigger Error</button>\n      </div>\n      <div style={{ marginTop: 20 }}>\n        {todos.map(todo => (\n          <div \n            key={todo.id} \n            className={'todo ' + (todo.done ? 'done' : '')}\n            onClick={() => toggle(todo)}\n          >\n            [{todo.done ? 'x' : ' '}] {todo.title}\n          </div>\n        ))}\n      </div>\n    </div>\n  );\n}\n\nexport default App;\n"
        }
      },
      "RendererDemo.jsx": {
        "file": {
          "contents": "import React from 'react';\nimport { Renderer, store, defineSchema, z } from '@agent-k/core';\nimport UserCard from './components/UserCard';\nimport homePageSpec from './pages/home.json';\n\n// 1. Define Schema & Data (Mock)\nconst UserSchema = z.object({\n  id: z.string(),\n  name: z.string(),\n  avatar: z.string()\n});\nconst UserDef = defineSchema('users', UserSchema, 'id');\nstore.register(UserDef);\n\n// Seed Data\n(async () => {\n  await store.init();\n  const users = store.db.collections.users;\n  const count = await users.find().exec().then(docs => docs.length);\n  if (count === 0) {\n    await users.insert({ id: 'u1', name: 'Alice', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice' });\n    await users.insert({ id: 'u2', name: 'Bob', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' });\n  }\n})();\n\n// 4. Renderer Demo\nexport default function RendererDemo() {\n  const componentRegistry = {\n    'UserCard': UserCard\n  };\n\n  const context = {\n    routeParams: {},\n    global: { currentUserId: 'u2' },\n    state: {},\n    navigate: (path) => alert(`Navigating to: ${path}`)\n  };\n\n  return (\n    <div style={{ width: '100vw', height: '100vh', background: '#f0f0f0' }}>\n      <Renderer \n        page={homePageSpec} \n        components={componentRegistry} \n        context={context}\n      />\n    </div>\n  );\n}\n"
        }
      },
      "components": {
        "directory": {
          "UserCard.jsx": {
            "file": {
              "contents": "import React from 'react';\n\nexport default function UserCard({ data, actions, style }) {\n  if (!data) return <div style={style}>Loading...</div>;\n  return (\n    <div style={{ \n      ...style, \n      background: 'white', \n      padding: 10, \n      borderRadius: 8, \n      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',\n      textAlign: 'center'\n    }}>\n      <img src={data.avatar} width=\"50\" height=\"50\" style={{ borderRadius: '50%' }} />\n      <h3>{data.name}</h3>\n      <button onClick={() => actions.navigate('/profile/' + data.id)}>View Profile</button>\n    </div>\n  );\n}\n"
            }
          }
        }
      },
      "index.css": {
        "file": {
          "contents": "body { font-family: sans-serif; padding: 20px; }\n.todo { display: flex; gap: 10px; margin-bottom: 5px; cursor: pointer; }\n.done { text-decoration: line-through; color: #888; }\n"
        }
      },
      "main.jsx": {
        "file": {
          "contents": "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport RendererDemo from './RendererDemo'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <RendererDemo />\n  </React.StrictMode>,\n)\n"
        }
      },
      "pages": {
        "directory": {
          "home.json": {
            "file": {
              "contents": "{\n  \"id\": \"p1\",\n  \"name\": \"HomePage\",\n  \"route\": \"/home\",\n  \"components\": [\n    {\n      \"id\": \"c1\",\n      \"type\": \"UserCard\",\n      \"canvas\": { \"x\": 50, \"y\": 50, \"width\": 150 },\n      \"data\": { \"collection\": \"users\", \"id\": \"u1\" }\n    },\n    {\n      \"id\": \"c2\",\n      \"type\": \"UserCard\",\n      \"canvas\": { \"x\": 250, \"y\": 100, \"width\": 150, \"rotation\": 10 },\n      \"data\": { \"collection\": \"users\", \"id\": { \"source\": \"global\", \"key\": \"currentUserId\" } }\n    }\n  ]\n}\n"
            }
          }
        }
      }
    }
  },
  "vite.config.js": {
    "file": {
      "contents": "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()]\n});\n"
    }
  },
  ".npmrc": {
    "file": {
      "contents": "registry=https://registry.npmmirror.com/"
    }
  }
};
