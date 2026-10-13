import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createRoute } from "@/app/actions";
import { currentUser } from "@/auth";
import { RouteForm } from "@/components/route-form";

export const metadata: Metadata = { title: "Share a route" };

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">Share a route</h1>
      <p className="mt-2 mb-8 text-text-2">
        Paste the share code from BeamJoy&apos;s race editor. We work out the length, gates, corners and
        elevation from it, so you only fill in the rest.
      </p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface" />}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  const user = await currentUser();
  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-display text-2xl font-semibold uppercase">Sign in to share</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Routes are tied to your account so you can edit them later and players know who built them.
        </p>
        <Link href="/signin?callbackUrl=/submit" className="btn-primary mt-6">
          Sign in
        </Link>
      </div>
    );
  }
  return <RouteForm action={createRoute} submitLabel="Publish route" />;
}
