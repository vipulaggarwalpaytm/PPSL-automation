"use client";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-navy)] mb-4">RA Portal</h1>
        <p className="text-sm text-[var(--color-foreground)] mb-6">
          Sign in with your Google account to continue
        </p>
        <button
          className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
          onClick={() => signIn("google")}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
