import Link from "next/link";
export default function AuthBrand() {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-3"
    >
      {/* Logo */}
      <div
        className="
          flex h-11 w-11 items-center justify-center
          rounded-2xl
          bg-white/10
          ring-1 ring-white/20
          backdrop-blur-md
          transition duration-300
          group-hover:scale-105
        "
      >
        <svg
          width="23"
          height="23"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M12 3V21"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          <path
            d="M12 6C9.7 4.1 6.8 4.1 4.5 6V18C6.8 16.1 9.7 16.1 12 18"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M12 6C14.3 4.1 17.2 4.1 19.5 6V18C17.2 16.1 14.3 16.1 12 18"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Nom */}
      <div>
        <div className="text-lg font-bold tracking-tight text-white">
          MySermon
          <span className="text-violet-300"> AI</span>
        </div>

        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">
          Préparez • Inspirez • Prêchez
        </div>
      </div>
    </Link>
  );
}
