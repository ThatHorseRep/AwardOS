"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadErrorProps {
  message?: string;
  onRetry: () => void;
}

export function LoadError({ message = "We could not load this page. Check your connection and try again.", onRetry }: LoadErrorProps) {
  return (
    <div role="alert" className="mx-auto flex min-h-64 max-w-lg flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
      <AlertCircle className="h-7 w-7 text-red-600" />
      <p className="text-sm font-medium text-red-900">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
    </div>
  );
}
