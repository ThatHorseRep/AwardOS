"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Monitor,
  Pencil,
  Smartphone,
} from "lucide-react";
import {
  acknowledgeBallotReviewAction,
  getEventDetailsAction,
} from "@/actions/events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type EventDetails = NonNullable<
  Awaited<ReturnType<typeof getEventDetailsAction>>
>;

export default function BallotPreviewPage() {
  const eventId = useParams<{ id: string }>().id;
  const toast = useToast();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await getEventDetailsAction(eventId);
      if (!result) throw new Error("Event not found");
      setEvent(result);
    } catch {
      setError("We could not load the ballot preview. Try again.");
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCategories = useMemo(
    () => event?.categories.filter((category) => category.isActive) ?? [],
    [event],
  );
  const invalidCategories = useMemo(
    () =>
      activeCategories.filter(
        (category) =>
          !category.nominees.some((nominee) => nominee.status === "ACTIVE"),
      ),
    [activeCategories],
  );

  async function approvePreview() {
    setApproving(true);
    try {
      await acknowledgeBallotReviewAction(eventId);
      toast.success(
        "Ballot review recorded. Any roster edit will require another review.",
      );
      await load();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "We could not approve this ballot.",
      );
    } finally {
      setApproving(false);
    }
  }

  if (!event && !error)
    return (
      <div
        className="min-h-96 animate-pulse rounded-xl bg-surface-muted"
        aria-label="Loading ballot preview"
      />
    );

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-16 text-content">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" aria-label="Back to event">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Ballot preview</h1>
            <p className="mt-1 text-sm text-content-secondary">
              Audit the complete voter experience before voting opens.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={viewport === "desktop" ? "primary" : "outline"}
            size="icon"
            aria-label="Desktop preview"
            onClick={() => setViewport("desktop")}
          >
            <Monitor className="size-4" />
          </Button>
          <Button
            variant={viewport === "mobile" ? "primary" : "outline"}
            size="icon"
            aria-label="Mobile preview"
            onClick={() => setViewport("mobile")}
          >
            <Smartphone className="size-4" />
          </Button>
          <Link href={`/events/${eventId}/nominations`}>
            <Button variant="outline">
              <Pencil className="mr-2 size-4" />
              Edit nominees
            </Button>
          </Link>
          <Button
            variant="primary"
            disabled={
              approving ||
              invalidCategories.length > 0 ||
              activeCategories.length === 0
            }
            onClick={() => void approvePreview()}
          >
            <CheckCircle2 className="mr-2 size-4" />
            Approve ballot
          </Button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm"
        >
          <p>{error}</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => void load()}
          >
            Try again
          </Button>
        </div>
      )}

      {event && (
        <>
          <section
            aria-label="Ballot validation"
            className={`flex items-start gap-3 rounded-lg border p-4 ${invalidCategories.length ? "border-warning/40 bg-warning/10" : "border-success/40 bg-success/10"}`}
          >
            {invalidCategories.length ? (
              <AlertTriangle className="mt-0.5 size-5 text-warning" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-5 text-success" />
            )}
            <div>
              <p className="font-semibold">
                {invalidCategories.length
                  ? "Ballot needs attention"
                  : "Ballot roster is complete"}
              </p>
              <p className="mt-1 text-sm text-content-secondary">
                {invalidCategories.length
                  ? `${invalidCategories.length} active ${invalidCategories.length === 1 ? "category has" : "categories have"} no eligible nominees.`
                  : "Every active category has at least one eligible nominee."}
              </p>
            </div>
          </section>

          <div className="overflow-x-auto py-2">
            <section
              aria-label={`${viewport} ballot preview`}
              className={`mx-auto overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm transition-[max-width] duration-300 ${viewport === "mobile" ? "max-w-[390px]" : "max-w-4xl"}`}
            >
              <header
                className="border-b border-border-subtle p-6 sm:p-8"
                style={{
                  borderTopColor: event.branding?.accentColor ?? undefined,
                  borderTopWidth: event.branding?.accentColor ? 4 : undefined,
                }}
              >
                {event.branding?.logoUrl && (
                  <Image
                    src={event.branding.logoUrl}
                    alt={`${event.name} logo`}
                    width={192}
                    height={48}
                    unoptimized
                    className="mb-5 max-h-12 max-w-48 object-contain"
                  />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">Ballot preview</Badge>
                  <Badge variant="neutral">
                    {event.visibility.toLowerCase()}
                  </Badge>
                </div>
                <h2 className="mt-4 text-3xl font-bold">{event.name}</h2>
                {event.description && (
                  <p className="mt-3 max-w-2xl text-sm text-content-secondary">
                    {event.description}
                  </p>
                )}
                <div className="mt-5 grid gap-3 text-xs text-content-secondary sm:grid-cols-3">
                  <p>
                    <span className="font-semibold text-content">
                      Verification:
                    </span>{" "}
                    {String(
                      (event.verificationConfig as { method?: string } | null)
                        ?.method ?? "NONE",
                    )
                      .replaceAll("_", " ")
                      .toLowerCase()}
                  </p>
                  <p>
                    <span className="font-semibold text-content">
                      Audience:
                    </span>{" "}
                    {String(event.audienceType)
                      .replaceAll("_", " ")
                      .toLowerCase()}
                  </p>
                  <p>
                    <span className="font-semibold text-content">Results:</span>{" "}
                    {String(event.liveResultsMode)
                      .replaceAll("_", " ")
                      .toLowerCase()}
                  </p>
                </div>
                <p className="mt-4 rounded-md bg-surface-muted p-3 text-sm text-content-secondary">
                  Voters may skip a category unless the event rules require a
                  selection. Each active category below must have an eligible
                  nominee before activation.
                </p>
              </header>
              <div className="space-y-6 p-4 sm:p-8">
                {activeCategories.map((category, index) => {
                  const eligible = category.nominees.filter(
                    (nominee) => nominee.status === "ACTIVE",
                  );
                  return (
                    <fieldset
                      key={category.id}
                      className={`rounded-lg border p-4 ${eligible.length ? "border-border-subtle" : "border-warning/50 bg-warning/5"}`}
                    >
                      <legend className="px-1 text-base font-semibold">
                        {index + 1}. {category.name}
                      </legend>
                      {category.description && (
                        <p className="mb-2 text-sm text-content-secondary">
                          {category.description}
                        </p>
                      )}
                      {category.eligibility && (
                        <p className="mb-4 text-xs text-content-muted">
                          Eligibility: {category.eligibility}
                        </p>
                      )}
                      {eligible.length ? (
                        <div className="space-y-2">
                          {eligible.map((nominee) => (
                            <label
                              key={nominee.id}
                              className="flex min-h-12 cursor-default items-center gap-3 rounded-lg border border-border-subtle px-3 py-2"
                            >
                              <input
                                type="radio"
                                disabled
                                name={`preview-${category.id}`}
                                className="size-4"
                              />
                              <span>
                                <span className="block font-medium">
                                  {nominee.name}
                                </span>
                                {nominee.bio && (
                                  <span className="block text-sm text-content-secondary">
                                    {nominee.bio}
                                  </span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p
                          role="alert"
                          className="text-sm font-medium text-warning"
                        >
                          This category has no active nominees and blocks ballot
                          activation.
                        </p>
                      )}
                    </fieldset>
                  );
                })}
                {activeCategories.length === 0 && (
                  <p
                    role="alert"
                    className="rounded-lg border border-warning/50 bg-warning/5 p-4 text-sm"
                  >
                    This event has no active categories and cannot open for
                    voting.
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
