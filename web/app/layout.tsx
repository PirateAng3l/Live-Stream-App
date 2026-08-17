import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "./_sign-out-button";
import "./globals.css";
import { getCurrentParent } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Open Door Live",
  description: "Live school sports streaming — schedule, live matches, and replays.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const parent = await getCurrentParent();

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-textprimary">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <a href="/" className="text-lg font-bold tracking-wide">
            OPEN DOOR <span className="text-accent">LIVE</span>
          </a>
          <nav className="text-sm">
            {parent ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-textsecondary sm:inline">{parent.email}</span>
                <SignOutButton />
              </div>
            ) : (
              <Link href="/sign-in" className="font-semibold text-accent">
                Sign in
              </Link>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
