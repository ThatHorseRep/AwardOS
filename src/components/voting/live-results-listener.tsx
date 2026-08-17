"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LiveResultsListenerProps {
  eventId: string;
  onVoteReceived?: () => void;
  showStatusBadge?: boolean;
}

export function LiveResultsListener({ eventId, onVoteReceived, showStatusBadge = true }: LiveResultsListenerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [voteCount, setVoteCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`live-votes-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "votes",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          setVoteCount((prev) => prev + 1);
          if (onVoteReceived) {
            onVoteReceived();
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, onVoteReceived]);

  if (!showStatusBadge) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
      <span className="relative flex h-2 w-2">
        {isConnected ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </>
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        )}
      </span>
      <span>{isConnected ? "Live Vote Stream Active" : "Connecting Live Feed..."}</span>
      {voteCount > 0 && (
        <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px] font-bold">
          +{voteCount} new
        </span>
      )}
    </div>
  );
}
