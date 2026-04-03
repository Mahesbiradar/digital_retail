const featureCards = [
  'Owner dashboard with live kiosk order feed',
  'Batch-based inventory with expiry tracking',
  'POS billing flow with barcode and camera scan',
  'Public self-checkout experience via permanent store QR'
];

export default function App() {
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_30px_80px_rgba(22,33,62,0.12)] backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-leaf">
            Digital Retail System
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-brand-ink sm:text-5xl">
            Kirana-first POS, inventory, and self-checkout in one workflow.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
            Task 1 scaffold is ready with React, Vite, Tailwind, Express, PostgreSQL,
            Redis, and the initial database schema for the Digital Retail platform.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {featureCards.map((feature) => (
            <article
              key={feature}
              className="rounded-[1.5rem] border border-brand-ink/10 bg-white/80 p-6 shadow-[0_16px_40px_rgba(31,122,77,0.08)]"
            >
              <p className="text-base font-semibold text-brand-ink">{feature}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
