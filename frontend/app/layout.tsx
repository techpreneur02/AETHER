import type { Metadata } from "next";
import AuthGuard from "../components/AuthGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "AETHER-IT | Operations Console",
  description: "Infrastructure topology and engineering simulator",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AuthGuard>{children}</AuthGuard></body>
    </html>
  );
}