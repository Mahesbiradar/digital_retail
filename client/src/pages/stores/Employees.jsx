import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/axios.js';

const defaultForm = {
  phone: '',
  role: 'manager'
};

export default function Employees() {
  const { storeId } = useParams();
  const [employees, setEmployees] = useState([]);
  const [formValues, setFormValues] = useState(defaultForm);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  const loadEmployees = async () => {
    try {
      const { data } = await apiClient.get(`/stores/${storeId}/employees`);
      setEmployees(data.employees ?? []);
      setStatus('ready');
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to load employees.');
      setStatus('error');
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [storeId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      await apiClient.post(`/stores/${storeId}/employees`, formValues);
      setFormValues(defaultForm);
      await loadEmployees();
      setMessage('Employee invite saved.');
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to invite employee.');
    }
  };

  const handleRemove = async (userId) => {
    try {
      await apiClient.delete(`/stores/${storeId}/employees/${userId}`);
      await loadEmployees();
      setMessage('Employee removed.');
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to remove employee.');
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f5efe2_0%,#fbfcf8_50%,#eef7ef_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] bg-brand-ink px-8 py-10 text-white shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-saffron">Employee Access</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">Manage assigned staff</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-200">
            Invite employees by phone number and role, then keep each store assignment organized here.
          </p>
          <div className="mt-6">
            <Link className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-brand-ink" to={`/stores/${storeId}`}>
              Back to store settings
            </Link>
          </div>
        </section>

        {message ? (
          <div className="rounded-[1.5rem] bg-white/90 p-4 text-sm font-medium text-brand-ink shadow-sm">
            {message}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <form className="rounded-[2rem] bg-white/90 p-8 shadow-[0_24px_60px_rgba(31,122,77,0.12)]" onSubmit={handleInvite}>
            <h2 className="text-2xl font-black text-brand-ink">Invite employee</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Phone</span>
                <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" name="phone" value={formValues.phone} onChange={handleChange} placeholder="9876543210" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Role</span>
                <select className="w-full rounded-2xl border border-slate-200 px-4 py-3" name="role" value={formValues.role} onChange={handleChange}>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                </select>
              </label>
            </div>
            <button className="mt-6 rounded-2xl bg-brand-leaf px-5 py-3 text-sm font-semibold text-white" type="submit">
              Invite employee
            </button>
          </form>

          <section className="rounded-[2rem] bg-white/90 p-8 shadow-[0_24px_60px_rgba(22,33,62,0.12)]">
            <h2 className="text-2xl font-black text-brand-ink">Current employees</h2>
            {status === 'loading' ? (
              <p className="mt-4 text-sm text-slate-600">Loading employees...</p>
            ) : null}

            <div className="mt-6 space-y-4">
              {employees.map((employee) => (
                <article key={employee.userId} className="rounded-[1.5rem] border border-brand-ink/10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-brand-ink">{employee.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{employee.phone}</p>
                      <p className="mt-1 text-sm text-slate-600">Role: {employee.role}</p>
                    </div>
                    <button
                      className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                      type="button"
                      onClick={() => handleRemove(employee.userId)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {status !== 'loading' && employees.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No employees assigned yet.</p>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
