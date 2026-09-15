import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/AppProviders';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { router } from './routes/router';
import './styles/globals.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Prometheus root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  </StrictMode>,
);
