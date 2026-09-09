"use server";

import { redirect } from "next/navigation";
import { getSignInUrl, signOut } from "@workos-inc/authkit-nextjs";

/** Only same-origin paths may be round-tripped through sign-in/out. */
function safePath(v: FormDataEntryValue | null, fallback: string): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

/**
 * Into AuthKit's hosted login. The screen is branded per WorkOS *environment*,
 * and we share resumarsh's — so the login page says resumarsh. That is
 * intended: the plug lands before the visitor has even converted.
 */
export async function startSignIn(formData: FormData): Promise<void> {
  redirect(await getSignInUrl({ returnTo: safePath(formData.get("returnTo"), "/") }));
}

export async function signOutAndReturn(formData: FormData): Promise<void> {
  await signOut({ returnTo: safePath(formData.get("returnTo"), "/") });
}
