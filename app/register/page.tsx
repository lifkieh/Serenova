"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    async function handleRegister() {
        const res = await fetch("/api/register", {
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

        localStorage.setItem("session", "user");

        alert("Registration successful");

        router.push("/login");
    }

    return (
        <main className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="w-full max-w-sm space-y-4 border border-white/10 p-8 rounded-2xl bg-zinc-950">
                <h1 className="text-3xl font-bold">
                    Register
                </h1>

                <input
                    className="w-full bg-zinc-900 border border-white/10 p-3 rounded-xl text-white"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input
                    type="password"
                    className="w-full bg-zinc-900 border border-white/10 p-3 rounded-xl text-white"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button
                    onClick={handleRegister}
                    className="w-full bg-white text-black p-3 rounded-xl"
                >
                    Register
                </button>

                <button
                    onClick={() => router.push("/login")}
                    className="w-full text-sm text-zinc-400 hover:text-white"
                >
                    Already have an account? Login
                </button>
            </div>
        </main>
    );
}