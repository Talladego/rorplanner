import './App.css';
import RoRview from './RoRview';
import pkg from '../package.json';

function App() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '8px 0 0 0' }}>
        <h1 style={{ color: '#eee', textAlign: 'center', margin: 0 }}>
          RORplanner <span className="app-version" title={`Version ${pkg.version}`}>v{pkg.version}</span>
        </h1>
      </div>
      <RoRview />
    </>
  );
}

export default App;
