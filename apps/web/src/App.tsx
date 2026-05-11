import { useAuth } from './features/auth/useAuth';
import { LoginPage } from './features/auth/LoginPage';
import { Dashboard } from './features/calendar/Dashboard';

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Dashboard user={user} />;
}
