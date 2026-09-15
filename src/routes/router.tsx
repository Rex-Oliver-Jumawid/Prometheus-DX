import { createBrowserRouter, Navigate } from 'react-router-dom';
import { FoundationPage } from '../features/foundation/FoundationPage';
import { NotFoundPage } from '../features/foundation/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/foundation" replace />,
  },
  {
    path: '/foundation',
    element: <FoundationPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
