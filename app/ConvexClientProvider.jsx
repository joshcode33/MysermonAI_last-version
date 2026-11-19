"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url) : null;

export default function ConvexClientProvider({ children }) {
  if (!convex) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center text-slate-600">
        Configuration manquante : NEXT_PUBLIC_CONVEX_URL n’est pas défini (voir .env.example).
      </main>
    );
  }
  return <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>;
}
