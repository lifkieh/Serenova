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

        alert("Register berhasil");

        router.push("/login");
    }

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="border border-white p-8 rounded-xl w-[350px]">
                <h1 className="text-2xl mb-6 font-bold">
                    Register
                </h1>

                <input
                    className="w-full mb-4 p-3 bg-black border border-white rounded text-white"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input
                    type="password"
                    className="w-full mb-4 p-3 bg-black border border-white rounded text-white"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button
                    onClick={handleRegister}
                    className="w-full border border-white p-3 rounded hover:bg-white hover:text-black transition"
                >
                    Register
                </button>

                <button
                    onClick={() => router.push("/login")}
                    className="w-full mt-4 text-sm text-zinc-400 hover:text-white"
                >
                    Already have an account? Login
                </button>
            </div>
        </div>
    );
}