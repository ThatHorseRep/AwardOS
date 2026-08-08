"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Final step of the password reset flow.
 *
 * `forgot-password` has always sent users here via
 * `/api/auth/callback?next=/reset-password`, but the route did not exist — so a
 * valid reset link landed on a 404 and no one could ever complete a reset.
 *
 * By the time this renders, the callback has already exchanged the emailed code
 * for a session, so `updateUser` is authorised without asking for the old
 * password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Without a recovery session the update would fail with an opaque error, so
  // say plainly that the link is expired and offer a new one.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setError("This reset link is invalid or has expired. Request a new one below.");
      }
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsPending(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsPending(false);
      return;
    }

    router.push("/sign-in?success=Password+updated.+Please+sign+in.");
  };

  if (checking) {
    return (
      <div className="w-full max-w-md mx-auto text-center text-zinc-400 text-xs py-8">
        Verifying your reset link…
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold text-white tracking-tight">Set a new password</h1>
        <p className="text-xs text-zinc-400">Choose a password you have not used before</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-zinc-300 mb-1">
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder:text-zinc-500 text-xs focus:outline-none focus:border-blue-500 transition-all pr-16 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300 text-[11px] font-semibold"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-xs font-semibold text-zinc-300 mb-1">
            Confirm new password
          </label>
          <input
            id="confirm"
            name="confirm"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder:text-zinc-500 text-xs focus:outline-none focus:border-blue-500 transition-all font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-2xl py-2.5 transition-colors"
        >
          {isPending ? "Updating…" : "Update password"}
        </button>
      </form>

      <p className="text-center text-zinc-400 text-xs font-medium">
        <Link
          href="/forgot-password"
          className="text-blue-400 hover:text-blue-300 transition-colors font-semibold"
        >
          Request a new reset link
        </Link>
      </p>
    </div>
  );
}
