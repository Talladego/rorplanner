import React from 'react';
import './App.css';
import RoRview from './RoRview';
import pkg from '../package.json';

function ErrorBoundaryWrapper({ children }) {
  return children;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error && (error.message || error)) };
  }
  componentDidCatch(error, info) {
    // Log for debugging; does not show alerts
    try { console.error('[App ErrorBoundary]', error, info); } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: '#eee', textAlign: 'center', padding: '24px' }}>
          <h2 style={{ marginTop: 12 }}>An error occurred</h2>
          <div style={{ opacity: 0.8, fontSize: '0.95rem' }}>{this.state.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const appVersion = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_VERSION) ? import.meta.env.VITE_APP_VERSION : pkg.version;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '8px 0 0 0' }}>
        <h1 style={{ color: '#eee', textAlign: 'center', margin: 0 }}>
          RORplanner
        </h1>
      </div>
      <ErrorBoundary>
        <RoRview />
      </ErrorBoundary>
    </>
  );
}

export default App;
