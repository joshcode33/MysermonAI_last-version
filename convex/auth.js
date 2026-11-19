import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

// Inscription / connexion e-mail + mot de passe. La récupération de mot de passe par e-mail
// n'est PAS activée : elle exige un fournisseur d'e-mails configuré (voir docs/STATUS.md).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        const name = String(params.name ?? "").trim().slice(0, 100);
        return name ? { email, name } : { email };
      },
      validatePasswordRequirements(password) {
        if (typeof password !== "string" || password.length < 8 || password.length > 200) {
          throw new Error("Le mot de passe doit contenir entre 8 et 200 caractères.");
        }
      },
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId) return;
      const user = await ctx.db.get(userId);
      await ctx.db.insert("profiles", {
        userId,
        displayName: user?.name || (user?.email ? user.email.split("@")[0] : "Utilisateur"),
        language: "fr",
        plan: "free",
        sermonCount: 0,
        preferences: {},
        createdAt: Date.now(),
      });
    },
  },
});
