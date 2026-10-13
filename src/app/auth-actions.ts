// alfiz-verify-ignore-file authentication (signing in and out), not authorization
"use server";

import { signIn, signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function signInWith(provider: string, callbackUrl: string, fd: FormData) {
  // Only same-site relative redirects.
  const redirectTo = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  if (provider === "dev") {
    await signIn("dev", { name: String(fd.get("name") ?? ""), redirectTo });
  } else {
    await signIn(provider, { redirectTo });
  }
}
