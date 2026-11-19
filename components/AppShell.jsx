"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/assistant", label: "Assistant biblique" },
  { href: "/bible", label: "Bible" },
  { href: "/sermons", label: "Mes sermons" },
  { href: "/profil", label: "Profil" },
];

export default function AppShell({ children, wide = false }) {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-slate-900">
            MySermon<span className="text-violet-600"> AI</span>
          </Link>
          <nav aria-label="Navigation principale" className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            {LINKS.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 font-semibold transition ${active ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-100"}`}>
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <Link href="/creation-sermon" className="hidden rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 sm:block">
            + Nouveau sermon
          </Link>
          <button type="button" onClick={async () => { await signOut(); router.replace("/Connexion"); }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Déconnexion
          </button>
        </div>
      </header>
      <main className={`mx-auto px-4 py-8 sm:px-6 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>{children}</main>
    </div>
  );
}
