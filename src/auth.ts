import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { freeSlug } from "@/lib/queries";

declare module "next-auth" {
  interface Session {
    user: { id: string; slug: string } & DefaultSession["user"];
  }
}

export const devLoginEnabled =
  process.env.AUTH_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

const providers: Provider[] = [];
// BeamMP's community lives on Discord, so it's the only real sign-in. It turns on once
// AUTH_DISCORD_ID and AUTH_DISCORD_SECRET are set. Discord sends `iss` on its redirect
// (RFC 9207), which Auth.js checks against the provider's issuer, and the built-in provider
// doesn't set one.
if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) {
  providers.push(Discord({ issuer: "https://discord.com" }));
}
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
        const db = getDb();
        const [existing] = await db
          .select({ slug: schema.users.slug })
          .from(schema.users)
          .where(eq(schema.users.id, id))
          .limit(1);
        let slug = existing?.slug;
        if (slug) {
          await db.update(schema.users).set({ name, image }).where(eq(schema.users.id, id));
        } else {
          // The profile URL is fixed at first sign-in; later renames don't move it.
          slug = await freeSlug(schema.users.slug, name, "driver");
          await db.insert(schema.users).values({ id, slug, name, image });
        }
        token.uid = id;
        token.slug = slug;
        token.name = name;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      if (token.slug) session.user.slug = token.slug as string;
      return session;
    },
  },
});

export async function currentUser() {
  const session = await auth();
  // A token from before profile slugs existed has no slug: treat it as signed out.
  return session?.user?.id && session.user.slug ? session.user : null;
}

