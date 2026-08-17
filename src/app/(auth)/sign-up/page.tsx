"use client";

import { useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { signUpAction } from "@/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { getAppOrigin } from "@/lib/app-url";
import { useSearchParams } from "next/navigation";

function SignUpForm() {
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (formData: FormData) => {
    startTransition(() => {
      signUpAction(formData);
    });
  };

  const handleGoogleSignIn = async () => {
    try {
      const supabase = createClient();
      const origin = getAppOrigin();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/api/auth/callback`,
        },
      });
    } catch (err: unknown) {
      console.error("Google sign up error:", err);
    }
  };

  return (
    <div className="w-full space-y-3.5 font-sans select-none">
      <div className="text-center space-y-0.5">
        <h1 className="text-xl font-bold text-content tracking-tight">Create your account</h1>
        <p className="text-xs text-content-secondary">Start organizing award events in minutes</p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs font-medium">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="name" className="block text-xs font-semibold text-content mb-1">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Jane Doe"
            className="w-full px-3.5 py-2 bg-surface-raised border border-border-subtle rounded-xl text-content placeholder:text-content-muted text-xs focus:outline-none focus:border-accent transition-all font-normal"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-content mb-1">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="w-full px-3.5 py-2 bg-surface-raised border border-border-subtle rounded-xl text-content placeholder:text-content-muted text-xs focus:outline-none focus:border-accent transition-all font-normal"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-content mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              placeholder="••••••••"
              className="w-full px-3.5 py-2 bg-surface-raised border border-border-subtle rounded-xl text-content placeholder:text-content-muted text-xs focus:outline-none focus:border-accent transition-all pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-secondary hover:text-content p-0.5"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-.722-3.25"/><path d="M2 8a10.645 10.645 0 0 0 20 0"/><path d="m20 15-1.726-2.05"/><path d="m4 15 1.726-2.05"/><path d="m9 18 .722-3.25"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-accent-contrast font-semibold text-xs rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1 shadow-sm active:scale-[0.97]"
        >
          {isPending ? (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <div className="relative py-0.5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-subtle"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-surface text-content-secondary font-medium">— or continue with —</span>
        </div>
      </div>

      <button
        onClick={handleGoogleSignIn}
        type="button"
        className="w-full py-2.5 px-4 bg-surface-raised hover:bg-surface-muted border border-border-subtle text-content font-semibold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm active:scale-[0.97]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18px" height="18px">
          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
        </svg>
        <span>Continue with Google</span>
      </button>

      <p className="text-center text-content-secondary text-xs">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-accent hover:underline transition-colors font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}

