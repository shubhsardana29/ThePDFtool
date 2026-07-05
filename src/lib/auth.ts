import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";

/**
 * OAuth providers activate only when their env vars are set (AUTH_GOOGLE_ID/
 * AUTH_GOOGLE_SECRET, AUTH_GITHUB_ID/AUTH_GITHUB_SECRET) — no secrets live in
 * code. With none configured, the app simply runs anonymous-only.
 */
const providers: Provider[] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_GITHUB_ID) providers.push(GitHub);

// Dev-only fake login so the signed-in tier can be exercised locally without
// OAuth credentials. Never registered in production builds.
if (process.env.NODE_ENV === "development") {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Dev login (development only)",
      credentials: { email: { label: "Email", type: "email" } },
      authorize: (credentials) => {
        const email = String(credentials?.email ?? "");
        if (!email.includes("@")) return null;
        return { id: `dev-${email}`, email, name: email.split("@")[0] };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  trustHost: true,
});

export function hasSignIn(): boolean {
  return providers.length > 0;
}
