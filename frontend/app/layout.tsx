import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AETHER-IT | Operations Console",
  description: "Infrastructure topology and engineering simulator",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}