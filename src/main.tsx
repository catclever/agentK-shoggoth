import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: any}> {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{color:'red', padding:'20px', background:'black', minHeight:'100vh'}}>
        <h2>App Crashed!</h2>
        <pre style={{whiteSpace:'pre-wrap'}}>{this.state.error.message}</pre>
        <pre style={{whiteSpace:'pre-wrap'}}>{this.state.error.stack}</pre>
      </div>
    );
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
