import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="text-center space-y-5">
        <h1 className="text-5xl font-semibold">Serenova</h1>

        <p className="text-zinc-400 max-w-md">
          A calm anonymous space to journal, reflect, and talk freely.
        </p>

        <div className="flex gap-3 justify-center">
          <Link
            href="/login"
            className="bg-zinc-800 px-5 py-3 rounded-xl"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="bg-white text-black px-5 py-3 rounded-xl"
          >
            Create Account
          </Link>
        </div>
      </div>
    </main>
  );
}