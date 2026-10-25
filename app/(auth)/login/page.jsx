'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '@/components/AuthShell';
import { useAuth } from '@/lib/AuthContext';
import { friendlyError } from '@/lib/authErrors';

const inputClass = 'input-field';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already logged in? Go straight to the dashboard
  useEffect(() => {
    if (!loading && user && !submitting) router.replace('/dashboard');
  }, [user, loading, submitting, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(friendlyError(err));
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle();
      router.replace('/dashboard');
    } catch (err) {
      setError(friendlyError(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Log In">
      <form onSubmit={handleSubmit} className="space-y-3 pt-2">
        <div>
          <label className="text-xs font-bold block mb-1">EMAIL</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder="you@example.com" className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-bold block mb-1">PASSWORD</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                 placeholder="••••••••" className={inputClass} />
        </div>

        {error && <p className="text-xs error-text">{error}</p>}

        <button type="submit" disabled={submitting}
                className="w-full py-3 text-sm accent-btn disabled:opacity-60">
          {submitting ? 'Please wait...' : 'Initialize Session 🔐'}
        </button>

        <button type="button" onClick={handleGoogle} disabled={submitting}
                className="w-full py-3 text-sm font-bold card hover:opacity-80 disabled:opacity-60">
          Continue with Google
        </button>
      </form>

      <p className="text-xs opacity-80">
        New here?{' '}
        <Link href="/register" className="font-bold underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}
