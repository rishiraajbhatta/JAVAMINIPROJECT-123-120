"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const LOGIN_API = "http://localhost:8080/api/receptionist/login";

export default function ReceptionistLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(LOGIN_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Invalid receptionist credentials.");
        return;
      }

      router.push("/receptionist/dashboard");
    } catch {
      setError(
        "Unable to connect to CuraSync server. Please make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f8fc] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100">

        {/* LEFT SIDE */}
        <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-cyan-800 text-white p-10 lg:p-14 flex flex-col justify-between min-h-[500px]">
          <div>
            <Link href="/" className="text-3xl font-bold tracking-tight">
              Cura<span className="text-cyan-300">Sync</span>
            </Link>

            <div className="mt-20">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm">
                <span className="w-2 h-2 bg-cyan-300 rounded-full animate-pulse" />
                Receptionist Portal
              </div>

              <h1 className="text-4xl lg:text-5xl font-bold leading-tight mt-6">
                Healthcare
                <br />
                coordination,
                <br />
                <span className="text-cyan-300">simplified.</span>
              </h1>

              <p className="mt-6 text-blue-50/80 text-lg leading-relaxed max-w-md">
                Manage patient appointments, coordinate doctor schedules,
                register walk-in patients, and handle payments — all from
                one centralized workspace.
              </p>
            </div>
          </div>

          <div className="mt-12 border-t border-white/20 pt-6">
            <p className="text-sm text-blue-100/70">
              CuraSync Hospital Management System
            </p>
            <p className="text-xs text-blue-100/50 mt-1">
              Secure access for authorized receptionists.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="p-8 lg:p-14 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-8">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-3xl mb-6">
                🏥
              </div>

              <h2 className="text-3xl font-bold text-gray-900">
                Welcome back
              </h2>

              <p className="text-gray-500 mt-2">
                Sign in to your receptionist account.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  placeholder="receptionist@curasync.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* ERROR */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              {/* LOGIN BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-200"
              >
                {loading ? "Signing in..." : "Sign In to Portal →"}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-blue-600 transition"
              >
                ← Back to CuraSync Home
              </Link>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400">
              <span>🔒</span>
              <span>Protected receptionist access</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}