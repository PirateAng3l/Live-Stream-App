"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { safeRedirectTarget } from "@/lib/redirect";
import { ParentSignUpForm } from "./parent-sign-up-form";
import { SchoolRequestForm } from "./school-request-form";

type SignUpMode = "parent" | "school";

export function SignUpForm() {
  const searchParams = useSearchParams();
  const redirectTarget = safeRedirectTarget(searchParams.get("redirect"));
  const [mode, setMode] = useState<SignUpMode>("parent");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">Create an account</h1>

      <div className="mb-6 flex gap-1 rounded-lg bg-panel p-1 text-sm font-semibold">
        <ModeButton active={mode === "parent"} onClick={() => setMode("parent")}>
          Parent
        </ModeButton>
        <ModeButton active={mode === "school"} onClick={() => setMode("school")}>
          School
        </ModeButton>
      </div>

      {mode === "parent" ? (
        <ParentSignUpForm redirectTarget={redirectTarget} />
      ) : (
        <SchoolRequestForm />
      )}

      <p className="mt-4 text-sm text-textsecondary">
        Already have an account?{" "}
        <Link href={`/sign-in?redirect=${encodeURIComponent(redirectTarget)}`} className="text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
        active ? "bg-accent text-white" : "text-textsecondary hover:text-textprimary"
      }`}
    >
      {children}
    </button>
  );
}
