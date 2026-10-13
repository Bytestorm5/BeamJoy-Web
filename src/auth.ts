import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import GitHub from "next-auth/providers/github";
import { connection } from "next/server";
import { db, schema } from "@/db";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const devLoginEnabled =
  process.env.AUTH_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

const providers: Provider[] = [];
// BeamMP's community lives on Discord, so it's the primary sign-in. Each provider only turns on
// once its credentials are configured (AUTH_DISCORD_ID/SECRET, AUTH_GITHUB_ID/SECRET).
if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) providers.push(Discord);
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { name: { label: "Display name", type: "text" } },
      authorize(credentials) {
        const name = String(credentials?.name ?? "").trim().slice(0, 40);
        if (!name) return null;
        return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name };
      },
    }),
  );
}

// Auth.js merges user options over provider defaults lazily, so read the overrides first.
export const providerList = providers.map((p) => {
  const cfg = typeof p === "function" ? p() : p;
  const opts = (cfg as { options?: { id?: string; name?: string } }).options;
  return { id: opts?.id ?? cfg.id, name: opts?.name ?? cfg.name };
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        const id = `${account.provider}:${account.providerAccountId}`;
        const name = (user?.name || "Driver").slice(0, 60);
        const image = user?.image ?? null;
        await db
          .insert(schema.users)
          .values({ id, name, image })
          .onConflictDoUpdate({ target: schema.users.id, set: { name, image } });
        token.uid = id;
        token.name = name;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});

export async function currentUser() {
  // Auth.js touches crypto before it reads the cookie; mark the read as request-time first so
  // Cache Components doesn't treat it as an unstable value during prerendering.
  await connection();
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

const adminIds = new Set(
  (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
export const isAdmin = (userId: string | undefined | null) => !!userId && adminIds.has(userId);
