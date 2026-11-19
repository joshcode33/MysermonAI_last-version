"use client";

import { forwardRef, useState } from "react";

const AuthInput = forwardRef(function AuthInput({
  label,
  type = "text",
  placeholder,
  error,
  ...inputProps
}, ref) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === "password";

  const inputType =
    isPassword && showPassword
      ? "text"
      : type;

  return (
    <div>
      {/* LABEL */}
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      {/* INPUT */}
      <div className="relative">
        <input
          type={inputType}
          ref={ref}
          placeholder={placeholder}
          {...inputProps}
          className={`
            h-12 w-full rounded-xl border
            bg-white px-4
            text-sm text-slate-900
            outline-none transition
            placeholder:text-slate-400

            ${
              error
                ? "border-red-400 focus:border-red-500"
                : "border-slate-200 focus:border-violet-500"
            }

            focus:ring-4

            ${
              error
                ? "focus:ring-red-500/10"
                : "focus:ring-violet-500/10"
            }

            ${isPassword ? "pr-12" : ""}
          `}
        />

        {/* AFFICHER / MASQUER */}
        {isPassword && (
          <button
            type="button"
            onClick={() =>
              setShowPassword((value) => !value)
            }
            className="
              absolute right-3 top-1/2
              -translate-y-1/2
              rounded-lg p-2
              text-slate-400
              transition
              hover:bg-slate-100
              hover:text-slate-700
            "
            aria-label={
              showPassword
                ? "Masquer le mot de passe"
                : "Afficher le mot de passe"
            }
          >
            {showPassword ? "◉" : "○"}
          </button>
        )}
      </div>

      {/* ERREUR */}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-500">
          {error.message}
        </p>
      )}
    </div>
  );
});

AuthInput.displayName = "AuthInput";

export default AuthInput;
