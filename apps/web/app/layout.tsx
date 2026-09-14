import type { Metadata } from "next";
import "@/styles/global.css";
import { AppHeader } from "@/components/app-header";
import { ProfileProvider } from "@/components/profile-provider";

const siteTitle = "Chartize — Query and visualize public data";
const siteDescription = "Query public data with GGSQL, build charts and maps, and ask AI what the results mean.";

export const metadata: Metadata = {
  metadataBase: new URL("https://chartize.dileepreddy.com"),
  title: siteTitle,
  description: siteDescription,
  applicationName: "Chartize",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Chartize",
    title: siteTitle,
    description: siteDescription,
    images: [{
      url: "/chartize-link-preview.png",
      width: 2048,
      height: 863,
      alt: "Chartize gallery showing public-data charts and maps",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/chartize-link-preview.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `try{const p=localStorage.getItem('chartize:appearance-profile')||'anonymous';const t=localStorage.getItem('chartize:theme:'+p)||'system';document.documentElement.dataset.theme=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch{}` }} />
        <ProfileProvider><AppHeader />{children}</ProfileProvider>
      </body>
    </html>
  );
}
