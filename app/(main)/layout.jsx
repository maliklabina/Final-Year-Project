import AppHeader from '@/components/AppHeader';
import AuthGuard from '@/components/AuthGuard';

export default function MainLayout({ children }) {
  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen pb-10">
        <AppHeader />
        <main className="max-w-7xl w-full mx-auto p-6 space-y-6 flex-1">{children}</main>
      </div>
    </AuthGuard>
  );
}
