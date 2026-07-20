import type { Metadata } from "next";
import "@/styles/global.css";
import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: "Chartize — Query and visualize public data",
  description: "A local-first GGSQL data and visualization studio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
