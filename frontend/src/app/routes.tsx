import type { RouteObject } from 'react-router';
import { Link } from 'react-router';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { LogsPage } from '../features/logs/LogsPage';
import { TaskDetailPage } from '../features/tasks/TaskDetailPage';
import { EditTaskPage, NewTaskPage } from '../features/tasks/TaskFormPage';
import { TasksPage } from '../features/tasks/TasksPage';
import { AppShell } from './AppShell';
import { RequireAuth } from './RequireAuth';

function NotFound() {
  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-accent underline">
        Back to the dashboard
      </Link>
    </div>
  );
}

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'tasks/new', element: <NewTaskPage /> },
      { path: 'tasks/:id', element: <TaskDetailPage /> },
      { path: 'tasks/:id/edit', element: <EditTaskPage /> },
      { path: 'logs', element: <LogsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];
