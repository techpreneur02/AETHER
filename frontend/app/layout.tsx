import type { Metadata } from "next";
import AuthGuard from "../components/AuthGuard";
import SiteFooter from "../components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "AETHER-IT | Operations Console",
  description: "Infrastructure topology and engineering simulator",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem("aether_theme")||"light"}catch{document.documentElement.dataset.theme="light"}`,
          }}
        />
      </head>
      <body><AuthGuard>{children}</AuthGuard><SiteFooter /></body>
    </html>
  );
}