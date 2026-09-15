import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="foundation-card max-w-lg text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Route not found</h1>
        <p className="mt-3 text-sm text-[rgb(var(--text-muted))]">
          This route is not part of the current implementation phase.
        </p>
        <Link className="foundation-button mt-5 inline-flex" to="/foundation">
          Open foundation
        </Link>
      </section>
    </main>
  );
}
