"use client";

import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";

/**
 * Session UI as a client island so the root layout (and every page under it)
 * stays statically renderable — the session is fetched after hydration.
 */
function AuthNavInner() {
  const { data: session, status } = useSession();

  if (status === "loading") return <span className="w-16" />;

  if (session?.user) {
    return (
      <span className="flex items-center gap-2">
        <span className="hidden max-w-40 truncate sm:inline" title={session.user.email ?? ""}>
          {session.user.email}
        </span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn()}
      className="rounded-md bg-red-500 px-3 py-1 font-medium text-white hover:bg-red-600"
    >
      Sign in
    </button>
  );
}

export function AuthNav({ hasProviders }: { hasProviders: boolean }) {
  if (!hasProviders) return null;
  return (
    <SessionProvider>
      <AuthNavInner />
    </SessionProvider>
  );
}
