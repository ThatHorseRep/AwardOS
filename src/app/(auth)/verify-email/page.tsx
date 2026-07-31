import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div className="w-full max-w-md mx-auto space-y-6 text-center">
      <div className="w-16 h-16 mx-auto bg-indigo-500/20 rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </div>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Check your email</h1>
        <p className="text-zinc-400 leading-relaxed">
          We've sent you a verification link.<br />
          Click it to activate your account.
        </p>
      </div>
      
      <div className="pt-6">
        <Link 
          href="/sign-in"
          className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center border border-zinc-700/50"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
