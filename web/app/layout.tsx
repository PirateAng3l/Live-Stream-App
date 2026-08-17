import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Door Live",
  description: "Live school sports streaming — schedule, live matches, and replays.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-textprimary">
        <header className="border-b border-white/10 px-6 py-4">
          <a href="/" className="text-lg font-bold tracking-wide">
            OPEN DOOR <span className="text-accent">LIVE</span>
          </a>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
