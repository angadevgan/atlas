"use client";

import { useState } from "react";
import { login, register } from "@/lib/api";

export default function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, displayName || undefined);
      onAuthed();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg text-text">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 font-display font-semibold text-xl mb-1">
            <span className="w-2 h-2 rounded-sm bg-accent inline-block" />
            Atlas
          </div>
          <p className="text-sm text-muted">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 bg-card border border-border rounded-lg p-6">
          {mode === "register" && (
            <div>
              <label className="block text-xs text-muted mb-1.5 font-mono">NAME</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-muted mb-1.5 font-mono">EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5 font-mono">PASSWORD</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-danger text-sm border border-danger/30 bg-danger/10 rounded-md px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white font-medium rounded-md py-2 text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-4">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button className="text-accent hover:underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
