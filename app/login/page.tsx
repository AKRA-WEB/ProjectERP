'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง / Invalid email or password');
    } else {
      router.push('/app/menu');
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="rounded-xl bg-white p-8 shadow-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">BUYMORE (THAILAND) COMPANY LIMITED</h1>
            <p className="mt-1 text-sm text-gray-500">ระบบบริหารจัดการองค์กร / Enterprise Resource Planning</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="อีเมล / Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              label="รหัสผ่าน / Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              เข้าสู่ระบบ / Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
