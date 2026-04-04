import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';

const defaultForm = {
  phone: '',
  password: ''
};

export default function Login() {
  const [formValues, setFormValues] = useState(defaultForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTarget = location.state?.from?.pathname ?? '/dashboard';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await login(formValues);
      navigate(redirectTarget, { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-brand-sand px-6 py-10 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] bg-brand-ink px-8 py-10 text-white shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-saffron">
            Owner Access
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            Sign in to manage your stores, staff, and billing flow.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">
            This auth step unlocks the protected dashboard experience and lays the
            groundwork for manager and cashier access in the next modules.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {['JWT access + refresh flow', 'Redis-backed refresh invalidation', 'Protected dashboard route', 'Ready for store-level roles'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_24px_60px_rgba(31,122,77,0.12)] backdrop-blur">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-leaf">
              Login
            </p>
            <h2 className="mt-3 text-3xl font-black text-brand-ink">Welcome back</h2>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Phone</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                name="phone"
                placeholder="9876543210"
                value={formValues.phone}
                onChange={handleChange}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formValues.password}
                onChange={handleChange}
              />
            </label>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <button
              className="w-full rounded-2xl bg-brand-leaf px-5 py-3 text-base font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            New business owner?{' '}
            <Link className="font-semibold text-brand-leaf" to="/signup">
              Create your account
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
