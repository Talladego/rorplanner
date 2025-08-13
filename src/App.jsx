import './App.css';
import RoRview from './RoRview';
import pkg from '../package.json';

function App() {
  const appVersion = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_VERSION) ? import.meta.env.VITE_APP_VERSION : pkg.version;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '8px 0 0 0' }}>
        <h1 style={{ color: '#eee', textAlign: 'center', margin: 0 }}>
          RORplanner <span className="app-version" title={`Version ${appVersion}`}>v{appVersion}</span>
        </h1>
      </div>
      <RoRview />
    </>
  );
}

export default App;
