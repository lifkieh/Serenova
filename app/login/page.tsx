"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    async function handleLogin() {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username,
                password,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error);
            return;
        }

        localStorage.setItem(
            "serenova_user",
            JSON.stringify(data.user)
        );

        localStorage.setItem("session", "user");

        router.push("/dashboard");
    }

    async function handleGuest() {
        await fetch("/api/guest", {
            method: "POST",
        });

        localStorage.setItem("session", "guest");

        router.push("/dashboard");
    }

    return (
        <main className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="w-full max-w-sm space-y-4 border border-white/10 p-8 rounded-2xl bg-zinc-950">
                <h1 className="text-3xl font-bold">
                    Welcome Back
                </h1>

                <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-zinc-900 border border-white/10 p-3 rounded-xl text-white"
                />

                <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Password"
                    className="w-full bg-zinc-900 border border-white/10 p-3 rounded-xl text-white"
                />

                <button
                    onClick={handleLogin}
                    className="w-full bg-white text-black p-3 rounded-xl"
                >
                    Login
                </button>

                <button
                    onClick={handleGuest}
                    className="w-full border border-white/10 p-3 rounded-xl"
                >
                    Continue as Guest
                </button>

                <button
                    onClick={() => router.push("/register")}
                    className="w-full text-sm text-zinc-400 hover:text-white"
                >
                    Don't have an account? Register
                </button>
            </div>
        </main>
    );
}