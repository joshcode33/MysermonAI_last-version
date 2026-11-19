"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SERMON_TYPES } from "@/convex/lib/sermonTypes";
import { buildGenerationParams, errorMessage } from "@/lib/sermonForm";

export default function CreationSermonPage() {
  return (
    <Suspense fallback={null}>
      <CreationSermonForm />
    </Suspense>
  );
}

function CreationSermonForm() {
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();
  const generate = useAction(api.generation.generate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    theme: "",
    bibleReference: searchParams.get("passage") ?? "",
    sermonType: SERMON_TYPES.expositif.label,
    audience: "Église",
    duration: "30 minutes",
    tone: "Enseignement",
    pointsCount: "3",
    detailLevel: "Standard",
    objective: "",
    mainIdeas: "",
    instructions: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };


const handleSubmit = async (
  event
) => {
  event.preventDefault();
  setSubmitError(null);
  setIsSubmitting(true);

  try {
    const { sermonId } = await generate({ params: buildGenerationParams(formData) });
    router.push(`/sermon/${sermonId}`);
  } catch (error) {
    console.error(
      "Erreur génération :",
      error
    );
    setSubmitError(errorMessage(error));
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="min-h-screen bg-[#f7f8fc]">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`
          fixed left-0 top-0 z-50
          flex h-screen flex-col
          border-r border-slate-200
          bg-white
          transition-all duration-300
          ${sidebarOpen ? "w-72" : "w-20"}
        `}
      >

        {/* LOGO */}

        <div
          className={`
            flex h-20 items-center
            border-b border-slate-100
            ${sidebarOpen ? "px-6" : "justify-center"}
          `}
        >

          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >

            <div
              className="
                flex h-10 w-10 shrink-0
                items-center justify-center
                rounded-xl
                bg-violet-600
                text-white
                shadow-lg shadow-violet-600/20
              "
            >
              ✦
            </div>

            {sidebarOpen && (
              <div>
                <p className="font-bold text-slate-900">
                  MySermon
                  <span className="text-violet-600">
                    {" "}AI
                  </span>
                </p>

                <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                  Votre assistant
                </p>
              </div>
            )}

          </Link>

        </div>


        {/* NAVIGATION */}

        <nav className="flex-1 space-y-2 px-3 py-6">

          <Link
            href="/dashboard"
            className="
              flex items-center gap-3
              rounded-xl
              px-4 py-3
              text-sm font-medium
              text-slate-600
              transition
              hover:bg-slate-50
              hover:text-violet-600
            "
          >
            <span className="text-lg">
              ⌂
            </span>

            {sidebarOpen && (
              <span>
                Accueil
              </span>
            )}

          </Link>


          <Link
            href="/creation-sermon"
            className="
              flex items-center gap-3
              rounded-xl
              bg-violet-50
              px-4 py-3
              text-sm font-semibold
              text-violet-700
            "
          >
            <span className="text-lg">
              ✎
            </span>

            {sidebarOpen && (
              <span>
                Créer un sermon
              </span>
            )}

          </Link>


          <button
            className="
              flex w-full items-center gap-3
              rounded-xl
              px-4 py-3
              text-left
              text-sm font-medium
              text-slate-600
              transition
              hover:bg-slate-50
              hover:text-violet-600
            "
          >

            <span className="text-lg">
              ▣
            </span>

            {sidebarOpen && (
              <span>
                Mes sermons
              </span>
            )}

          </button>


          <button
            className="
              flex w-full items-center gap-3
              rounded-xl
              px-4 py-3
              text-left
              text-sm font-medium
              text-slate-600
              transition
              hover:bg-slate-50
              hover:text-violet-600
            "
          >

            <span className="text-lg">
              ⚙
            </span>

            {sidebarOpen && (
              <span>
                Paramètres
              </span>
            )}

          </button>

        </nav>


        {/* PROFIL */}

        <div className="border-t border-slate-100 p-3">

          <Link
            href="/profil"
            className={`
              flex items-center gap-3
              rounded-xl p-3
              transition
              hover:bg-slate-50
              ${!sidebarOpen ? "justify-center" : ""}
            `}
          >

            <div
              className="
                flex h-10 w-10 shrink-0
                items-center justify-center
                rounded-full
                bg-violet-100
                font-bold
                text-violet-700
              "
            >
              JA
            </div>

            {sidebarOpen && (
              <div className="min-w-0">

                <p className="truncate text-sm font-bold text-slate-800">
                  Jean Akilimali
                </p>

                <p className="truncate text-xs text-slate-400">
                  Mon profil
                </p>

              </div>
            )}

          </Link>

        </div>

      </aside>


      {/* =====================================================
          CONTENU
      ===================================================== */}

      <main
        className={`
          min-h-screen
          transition-all duration-300
          ${sidebarOpen ? "ml-72" : "ml-20"}
        `}
      >

        {/* HEADER */}

        <header
          className="
            sticky top-0 z-30
            flex h-20
            items-center justify-between
            border-b border-slate-200
            bg-white/90
            px-6
            backdrop-blur-xl
          "
        >

          <div className="flex items-center gap-4">

            <button
              onClick={() =>
                setSidebarOpen((value) => !value)
              }
              className="
                flex h-10 w-10
                items-center justify-center
                rounded-xl
                border border-slate-200
                text-slate-600
                transition
                hover:bg-slate-50
              "
            >
              {sidebarOpen ? "←" : "→"}
            </button>

            <div>

              <p className="text-sm text-slate-400">
                Création
              </p>

              <h1 className="font-bold text-slate-900">
                Nouvelle prédication
              </h1>

            </div>

          </div>


          <Link
            href="/dashboard"
            className="
              rounded-xl
              border border-slate-200
              px-4 py-2
              text-sm font-semibold
              text-slate-600
              transition
              hover:bg-slate-50
            "
          >
            ← Retour
          </Link>

        </header>


        {/* BODY */}

        <div className="mx-auto max-w-5xl p-6 lg:p-10">

          {/* HEADER PAGE */}

          <div className="mb-8">

            <div
              className="
                mb-4
                inline-flex
                items-center gap-2
                rounded-full
                bg-violet-50
                px-3 py-1.5
                text-xs font-semibold
                text-violet-600
              "
            >
              ✦ Assistant IA
            </div>

            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Créons votre prochaine prédication
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Donnez quelques informations à MySermon AI.
              L’intelligence artificielle pourra ensuite
              vous aider à structurer votre message.
            </p>

          </div>


          {/* FORMULAIRE */}

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >

            {/* =================================================
                INFORMATIONS PRINCIPALES
            ================================================= */}

            <section
              className="
                rounded-2xl
                border border-slate-200
                bg-white
                p-6
                shadow-sm
              "
            >

              <div className="mb-6">

                <h3 className="font-bold text-slate-900">
                  Informations principales
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Commencez par définir votre message.
                </p>

              </div>


              <div className="grid gap-5 md:grid-cols-2">

                {/* TITRE */}

                <InputField
                  name="title"
                  label="Titre de la prédication"
                  placeholder="Ex : Les mensonges du diable"
                  value={formData.title}
                  onChange={handleChange}
                />


                {/* THÈME */}

                <InputField
                  name="theme"
                  label="Thème"
                  placeholder="Ex : Combat spirituel"
                  value={formData.theme}
                  onChange={handleChange}
                />


                {/* PASSAGE */}

                <InputField
                  name="bibleReference"
                  label="Passage biblique"
                  placeholder="Ex : Jean 8:44"
                  value={formData.bibleReference}
                  onChange={handleChange}
                />


                {/* TYPE */}

                <SelectField
                  name="sermonType"
                  label="Type de prédication"
                  value={formData.sermonType}
                  onChange={handleChange}
                  options={Object.values(SERMON_TYPES).map((t) => t.label)}
                />

              </div>

            </section>


            {/* =================================================
                AUDIENCE
            ================================================= */}

            <section
              className="
                rounded-2xl
                border border-slate-200
                bg-white
                p-6
                shadow-sm
              "
            >

              <div className="mb-6">

                <h3 className="font-bold text-slate-900">
                  Votre audience
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Adaptez le message aux personnes qui
                  vont l’écouter.
                </p>

              </div>


              <div className="grid gap-5 md:grid-cols-3">

                <SelectField
                  name="audience"
                  label="Audience"
                  value={formData.audience}
                  onChange={handleChange}
                  options={[
                    "Église",
                    "Jeunesse",
                    "Enfants",
                    "Couples",
                    "Nouveaux croyants",
                    "Évangélisation",
                  ]}
                />


                <SelectField
                  name="duration"
                  label="Durée souhaitée"
                  value={formData.duration}
                  onChange={handleChange}
                  options={[
                    "15 minutes",
                    "30 minutes",
                    "45 minutes",
                    "1 heure",
                    "1h30",
                  ]}
                />


                <SelectField
                  name="tone"
                  label="Style"
                  value={formData.tone}
                  onChange={handleChange}
                  options={["Enseignement", "Encourageant", "Exhortation", "Évangélisation", "Contemplatif", "Solennel"]}
                />

                <SelectField
                  name="pointsCount"
                  label="Points principaux"
                  value={formData.pointsCount}
                  onChange={handleChange}
                  options={["1", "2", "3", "4", "5", "6", "7"]}
                />

                <SelectField
                  name="detailLevel"
                  label="Niveau de détail"
                  value={formData.detailLevel}
                  onChange={handleChange}
                  options={["Concis", "Standard", "Détaillé"]}
                />

              </div>

            </section>


            {/* =================================================
                OBJECTIF
            ================================================= */}

            <section
              className="
                rounded-2xl
                border border-slate-200
                bg-white
                p-6
                shadow-sm
              "
            >

              <div className="mb-6">

                <h3 className="font-bold text-slate-900">
                  Intention du message
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Expliquez à l’IA ce que vous souhaitez
                  transmettre.
                </p>

              </div>


              <TextAreaField
                name="objective"
                label="Quel est l'objectif de cette prédication ?"
                placeholder="Ex : Je veux aider les membres de l'église à identifier les mensonges du diable et à comprendre comment s'en protéger grâce à la Parole de Dieu."
                value={formData.objective}
                onChange={handleChange}
              />

            </section>


            {/* =================================================
                IDÉES PRINCIPALES
            ================================================= */}

            <section
              className="
                rounded-2xl
                border border-slate-200
                bg-white
                p-6
                shadow-sm
              "
            >

              <div className="mb-6">

                <h3 className="font-bold text-slate-900">
                  Vos idées principales
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Ajoutez les points que vous souhaitez
                  absolument retrouver dans le message.
                </p>

              </div>


              <TextAreaField
                name="mainIdeas"
                label="Points importants"
                placeholder={`Ex :

• Le mensonge commence par une déformation de la vérité
• Le diable cherche à éloigner l'homme de Dieu
• Jésus est la vérité
• Comment reconnaître les mensonges spirituels`}
                value={formData.mainIdeas}
                onChange={handleChange}
              />

            </section>


            {/* =================================================
                INSTRUCTIONS
            ================================================= */}

            <section
              className="
                rounded-2xl
                border border-slate-200
                bg-white
                p-6
                shadow-sm
              "
            >

              <div className="mb-6">

                <h3 className="font-bold text-slate-900">
                  Instructions supplémentaires
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Donnez des indications supplémentaires
                  à MySermon AI.
                </p>

              </div>


              <TextAreaField
                name="instructions"
                label="Instructions"
                placeholder="Ex : Ajoute une introduction forte, plusieurs exemples bibliques, des applications pratiques et une conclusion avec un appel à la repentance."
                value={formData.instructions}
                onChange={handleChange}
              />

            </section>


            {/* =================================================
                ACTION
            ================================================= */}

            <div
              className="
                flex flex-col-reverse
                gap-3
                sm:flex-row
                sm:justify-end
              "
            >

              <Link
                href="/dashboard"
                className="
                  flex h-12
                  items-center justify-center
                  rounded-xl
                  border border-slate-200
                  bg-white
                  px-6
                  text-sm font-semibold
                  text-slate-600
                  transition
                  hover:bg-slate-50
                "
              >
                Annuler
              </Link>


              <button
                type="submit"
                disabled={isSubmitting}
                className="
                  group
                  flex h-12
                  items-center justify-center
                  gap-2
                  rounded-xl
                  bg-violet-600
                  px-7
                  text-sm font-bold
                  text-white
                  shadow-lg
                  shadow-violet-600/20
                  transition
                  hover:-translate-y-0.5
                  hover:bg-violet-700
                  hover:shadow-xl
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >

                <span>
                  ✦
                </span>

                {isSubmitting ? "Génération en cours…" : "Générer ma prédication"}

                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>

              </button>

            </div>

            {submitError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {submitError}
              </p>
            )}

          </form>

        </div>

      </main>

    </div>
  );
}


/* ============================================================
   INPUT
============================================================ */

function InputField({
  name,
  label,
  placeholder,
  value,
  onChange,
}) {
  return (
    <div>

      <label
        htmlFor={name}
        className="
          mb-2 block
          text-sm font-semibold
          text-slate-700
        "
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="
          h-12 w-full
          rounded-xl
          border border-slate-200
          bg-white
          px-4
          text-sm
          text-slate-900
          outline-none
          transition
          placeholder:text-slate-400
          focus:border-violet-500
          focus:ring-4
          focus:ring-violet-500/10
        "
      />

    </div>
  );
}


/* ============================================================
   SELECT
============================================================ */

function SelectField({
  name,
  label,
  value,
  onChange,
  options,
}) {
  return (
    <div>

      <label
        htmlFor={name}
        className="
          mb-2 block
          text-sm font-semibold
          text-slate-700
        "
      >
        {label}
      </label>

      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="
          h-12 w-full
          rounded-xl
          border border-slate-200
          bg-white
          px-4
          text-sm
          text-slate-700
          outline-none
          transition
          focus:border-violet-500
          focus:ring-4
          focus:ring-violet-500/10
        "
      >

        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}

      </select>

    </div>
  );
}


/* ============================================================
   TEXTAREA
============================================================ */

function TextAreaField({
  name,
  label,
  placeholder,
  value,
  onChange,
}) {
  return (
    <div>

      <label
        htmlFor={name}
        className="
          mb-2 block
          text-sm font-semibold
          text-slate-700
        "
      >
        {label}
      </label>

      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={5}
        className="
          w-full
          resize-y
          rounded-xl
          border border-slate-200
          bg-white
          px-4 py-3
          text-sm
          leading-6
          text-slate-900
          outline-none
          transition
          placeholder:text-slate-400
          focus:border-violet-500
          focus:ring-4
          focus:ring-violet-500/10
        "
      />

    </div>
  );
}
