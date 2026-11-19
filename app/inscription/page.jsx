"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import AuthInput from "@/components/AuthInput";
import AuthLayout from "@/components/AuthLayout";

export default function InscriptionPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    if (String(form.get("password")).length < 8) {
      setMessage("Utilisez au moins 8 caractères.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      form.delete("confirmPassword");
      form.delete("terms");
      form.set("flow", "signUp");
      await signIn("password", form);
      router.replace("/dashboard");
    } catch {
      setMessage("Inscription impossible. Cette adresse est peut-être déjà utilisée.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout mode="register" title="Créez votre compte" description="Préparez des prédications mieux structurées avec MySermon AI.">
      <form onSubmit={onSubmit} className="space-y-4">
        <AuthInput label="Nom complet" name="name" autoComplete="name" required />
        <AuthInput label="Adresse e-mail" name="email" type="email" autoComplete="email" required />
        <AuthInput label="Mot de passe" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <AuthInput label="Confirmer le mot de passe" name="confirmPassword" type="password" autoComplete="new-password" required />
        <label className="flex gap-3 text-xs leading-5 text-slate-500">
          <input type="checkbox" name="terms" required className="mt-1 accent-violet-600" />
          <span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span>
        </label>
        {message && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-bold text-white disabled:opacity-60">
          {loading ? "Création du compte…" : "Créer mon compte"}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-500">
        Vous avez déjà un compte ? <Link href="/Connexion" className="font-bold text-violet-600">Se connecter</Link>
      </p>
    </AuthLayout>
  );
}
