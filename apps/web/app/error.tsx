"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="error-page">
      <p className="eyebrow">Chartize error</p>
      <h1>That view could not be opened.</h1>
      <p>{error.message}</p>
      <button className="primary-button" onClick={reset}>Try again</button>
    </main>
  );
}
