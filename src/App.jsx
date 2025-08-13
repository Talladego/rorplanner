import './App.css';
import RoRview from './RoRview';

function App() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '8px 0 0 0' }}>
        <h1 style={{ color: '#eee', textAlign: 'center', margin: 0 }}>RORplanner</h1>
      </div>
      <RoRview />
    </>
  );
}

export default App;
