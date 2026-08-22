import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "./_sign-out-button";
import "./globals.css";
import { getCurrentParent } from "@/lib/auth";
import { getCurrentStaffProfile } from "@/lib/staff";

export const metadata: Metadata = {
  title: "Open Door Live",
  description: "Live school sports streaming — schedule, live matches, and replays.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Both read the same underlying session (each cache()'d per-request, see
  // lib/auth.ts / lib/staff.ts) — this just decides what the header shows,
  // it's not where any real access control happens. A staff account is
  // also a valid session for getCurrentParent's purposes (nothing stops a
  // school_operator from being shown as "signed in" here too); the only
  // consequence is their email showing in this header like a parent's
  // would, which is harmless.
  const [parent, staff] = await Promise.all([getCurrentParent(), getCurrentStaffProfile()]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-textprimary">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <a href="/" className="text-lg font-bold tracking-wide">
            OPEN DOOR <span className="text-accent">LIVE</span>
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/schedule" className="font-semibold text-textsecondary hover:text-textprimary">
              Schedule
            </Link>
            <Link href="/about" className="font-semibold text-textsecondary hover:text-textprimary">
              About
            </Link>
            {staff && (
              <Link href="/admin" className="font-semibold text-textsecondary hover:text-textprimary">
                Admin
              </Link>
            )}
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
        <footer className="mx-auto flex max-w-4xl flex-wrap gap-4 px-6 py-6 text-xs text-textsecondary">
          <Link href="/safety" className="hover:text-textprimary">
            Safety &amp; Consent
          </Link>
          <Link href="/privacy" className="hover:text-textprimary">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-textprimary">
            Terms
          </Link>
          <Link href="/report-concern" className="hover:text-textprimary">
            Report a concern
          </Link>
        </footer>
      </body>
    </html>
  );
}
