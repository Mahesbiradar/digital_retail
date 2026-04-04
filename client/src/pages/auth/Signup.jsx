import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';

const defaultForm = {
  name: '',
  phone: '',
  password: '',
  businessName: ''
};

export default function Signup() {
  const [formValues, setFormValues] = useState(defaultForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signup = useAuthStore((state) => state.signup);
  const navigate = useNavigate();

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
      await signup(formValues);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#eef7ef_0%,#fff6e8_52%,#fffdfa_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-brand-ink/10 bg-white/85 p-8 shadow-[0_24px_60px_rgba(22,33,62,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-saffron">
            Business Signup
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-brand-ink">
            Launch your Kirana operating system in one step.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-700">
            Signing up creates the business record and the owner account together,
            matching the auth module contract from the project prompt.
          </p>
          <div className="mt-10 space-y-4">
            {[
              'Business and owner are created in one transaction',
              'Owner role is attached to the first user automatically',
              'Access and refresh tokens are returned immediately'
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-brand-sand px-4 py-4 text-sm font-semibold text-brand-ink">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] bg-brand-ink px-8 py-10 text-white shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-saffron">
              Create Account
            </p>
            <h2 className="mt-3 text-3xl font-black">Set up your owner account</h2>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-100">Your name</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-300 focus:border-brand-saffron focus:ring-4 focus:ring-brand-saffron/10"
                name="name"
                placeholder="Aman Gupta"
                value={formValues.name}
                onChange={handleChange}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-100">Business name</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-300 focus:border-brand-saffron focus:ring-4 focus:ring-brand-saffron/10"
                name="businessName"
                placeholder="Ram General Store"
                value={formValues.businessName}
                onChange={handleChange}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-100">Phone</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-300 focus:border-brand-saffron focus:ring-4 focus:ring-brand-saffron/10"
                name="phone"
                placeholder="9876543210"
                value={formValues.phone}
                onChange={handleChange}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-100">Password</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-300 focus:border-brand-saffron focus:ring-4 focus:ring-brand-saffron/10"
                type="password"
                name="password"
                placeholder="At least 6 characters"
                value={formValues.password}
                onChange={handleChange}
              />
            </label>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
                {errorMessage}
              </div>
            ) : null}

            <button
              className="w-full rounded-2xl bg-brand-saffron px-5 py-3 text-base font-semibold text-brand-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account...' : 'Create owner account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-300">
            Already have an account?{' '}
            <Link className="font-semibold text-brand-saffron" to="/login">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
