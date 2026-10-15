"use server";

import { redirect } from "next/navigation";
import { getViewer, isAccessDenied, requireLinkGame } from "@/lib/access";
import { approveLink, normalizeUserCode } from "@/lib/game/link";

export type LinkState = { error?: string };

/** Approves the code the game shows, for the signed-in account. */
export async function approveGameLink(_prev: LinkState, fd: FormData): Promise<LinkState> {
  let user;
  try {
    user = await requireLinkGame(await getViewer());
  } catch (e) {
    if (!isAccessDenied(e)) throw e;
    return { error: e.reason === "unauthenticated" ? "Sign in first." : "Your account can't link the game." };
  }
  const code = normalizeUserCode(String(fd.get("code") ?? ""));
  if (!code) return { error: "Codes look like ABCD-2345." };
  if (!(await approveLink(code, user.id))) return { error: "That code expired or was already used. Get a new one in game." };
  redirect("/link?done=1");
}
