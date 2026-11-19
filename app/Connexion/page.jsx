"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import AuthInput from "@/components/AuthInput";
import AuthLayout from "@/components/AuthLayout";

export default function ConnexionPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage(null);
    try {
      form.set("flow", "signIn");
      await signIn("password", form);
      router.replace("/dashboard");
    } catch {
      setMessage("Adresse e-mail ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout mode="login" title="Connectez-vous à votre espace" description="Retrouvez vos prédications, vos notes et vos outils de préparation.">
      <form onSubmit={onSubmit} className="space-y-5">
        <AuthInput label="Adresse e-mail" name="email" type="email" autoComplete="email" required />
        <AuthInput label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
        {message && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-bold text-white disabled:opacity-60">
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <p className="mt-8 text-center text-sm text-slate-500">
        Vous n’avez pas encore de compte ? <Link href="/inscription" className="font-bold text-violet-600">Créer un compte</Link>
      </p>
    </AuthLayout>
  );
}
