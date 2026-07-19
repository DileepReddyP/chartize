"use client";

import dynamic from "next/dynamic";

const Explorer = dynamic(
  () => import("./explorer").then((module) => module.Explorer),
  {
    ssr: false,
    loading: () => <main className="loading-page"><div className="spinner" /> Loading Chartize…</main>,
  },
);

export function ExploreShell() {
  return <Explorer />;
}
