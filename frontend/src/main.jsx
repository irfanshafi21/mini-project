import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

class AppErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Question Bank workspace render failed:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return <main className="app-crash-fallback" role="alert"><h1>The workspace hit an unexpected error</h1><p>Your page is still available. Reload the workspace to continue.</p><button className="primary" onClick={() => window.location.reload()}>Reload workspace</button></main>
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
)
