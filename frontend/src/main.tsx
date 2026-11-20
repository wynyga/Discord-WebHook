import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Providers } from './app/Providers';
import { routes } from './app/routes';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/index.css';

// Popover is only newly available: load the polyfill where it is missing, never everywhere.
if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
  void import('@oddbird/popover-polyfill');
}

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
