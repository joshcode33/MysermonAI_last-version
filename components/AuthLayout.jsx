import AuthBrand from "./AuthBrand";

export default function AuthLayout({
  children,
  title,
  description,
  mode = "login",
}) {
  return (
    <main className="min-h-screen bg-[#f7f8fc]">

      <div className="grid min-h-screen lg:grid-cols-2">

        {/* =================================================
            PARTIE GAUCHE
        ================================================= */}

        <section
          className="
            relative hidden overflow-hidden
            bg-[#17142b]
            lg:flex
          "
        >
          {/* Lumière violette */}

          <div
            className="
              absolute -left-32 -top-32
              h-[500px] w-[500px]
              rounded-full
              bg-violet-600/30
              blur-3xl
            "
          />

          <div
            className="
              absolute -bottom-40 -right-40
              h-[500px] w-[500px]
              rounded-full
              bg-indigo-500/20
              blur-3xl
            "
          />

          {/* Grille */}

          <div
            className="
              absolute inset-0
              opacity-[0.04]
              [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)]
              [background-size:50px_50px]
            "
          />

          <div className="relative z-10 flex w-full flex-col p-10 xl:p-14">

            <AuthBrand />

            <div className="my-auto max-w-xl">

              {/* Badge */}

              <div
                className="
                  mb-7 inline-flex items-center gap-2
                  rounded-full
                  border border-white/10
                  bg-white/5
                  px-4 py-2
                  text-sm text-white/70
                  backdrop-blur-md
                "
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />

                L’intelligence au service de votre ministère
              </div>

              {/* Titre */}

              <h1
                className="
                  text-5xl font-bold
                  leading-[1.08]
                  tracking-tight
                  text-white
                  xl:text-6xl
                "
              >
                Préparez des messages

                <span className="block text-violet-300">
                  qui touchent les cœurs.
                </span>
              </h1>

              {/* Description */}

              <p className="mt-7 max-w-lg text-lg leading-8 text-white/60">
                MySermon AI vous accompagne dans la préparation,
                la structuration et l’amélioration de vos
                prédications grâce à l’intelligence artificielle.
              </p>

              {/* Verset */}

              <div className="mt-10 max-w-lg border-l border-violet-400/40 pl-5">

                <p className="text-sm italic leading-7 text-white/60">
                  « Que la parole de Christ habite en vous
                  richement. »
                </p>

                <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-violet-300">
                  Colossiens 3:16
                </p>

              </div>

              {/* Statistiques */}

              <div className="mt-12 flex gap-10">

                <div>
                  <p className="text-2xl font-bold text-white">
                    IA
                  </p>

                  <p className="mt-1 text-xs text-white/40">
                    Assistant intelligent
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-bold text-white">
                    24/7
                  </p>

                  <p className="mt-1 text-xs text-white/40">
                    Disponible partout
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-bold text-white">
                    100%
                  </p>

                  <p className="mt-1 text-xs text-white/40">
                    Votre espace personnel
                  </p>
                </div>

              </div>

            </div>

            <p className="text-xs text-white/30">
              © 2026 MySermon AI — Tous droits réservés.
            </p>

          </div>
        </section>


        {/* =================================================
            PARTIE DROITE
        ================================================= */}

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">

          <div className="w-full max-w-md">

            {/* LOGO MOBILE */}

            <div className="mb-10 lg:hidden">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
                  <span className="text-lg text-white">
                    ✦
                  </span>
                </div>

                <div>
                  <p className="font-bold text-slate-900">
                    MySermon
                    <span className="text-violet-600">
                      {" "}AI
                    </span>
                  </p>

                  <p className="text-[9px] font-medium uppercase tracking-widest text-slate-400">
                    Préparez • Inspirez • Prêchez
                  </p>
                </div>

              </div>

            </div>

            {/* EN-TÊTE */}

            <div className="mb-8">

              <p className="mb-3 text-sm font-semibold text-violet-600">
                {mode === "login"
                  ? "Bon retour 👋"
                  : "Bienvenue dans MySermon AI"}
              </p>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {title}
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                {description}
              </p>

            </div>

            {/* FORMULAIRE */}

            {children}

          </div>

        </section>

      </div>

    </main>
  );
}
