import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import schemaLoader from './schemaLoader.js'

async function bootstrap() {
  // Ensure the schema is fetched from production at app start.
  await schemaLoader.ensureSchemaLoaded();
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
