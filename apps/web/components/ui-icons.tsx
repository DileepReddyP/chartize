import type { ReactNode, SVGProps } from "react";

const paths = {
  user: <><circle cx="12" cy="8" r="3.25" /><path d="M5.75 20c.55-4 2.65-6 6.25-6s5.7 2 6.25 6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  moon: <path d="M20.5 13.4A8.6 8.6 0 0 1 10.6 3.5a8.6 8.6 0 1 0 9.9 9.9Z" />,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="1" /><path d="M12 17v4m-4 0h8" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
  spark: <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z" />,
  at: <><circle cx="12" cy="12" r="4" /><path d="M16 8v6a2 2 0 0 0 4 0v-2a8 8 0 1 0-3.3 6.5" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
} satisfies Record<string, ReactNode>;

/** Consistently sized line icons for studio controls. */
export function UiIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
