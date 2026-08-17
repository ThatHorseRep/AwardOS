import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleCheck,
  Fingerprint,
  LockKeyhole,
  Sparkles,
  Users,
} from "lucide-react";

const workflow = [
  "Collect nominations",
  "Review the ballot",
  "Open voting",
  "Publish results",
];
const categories = [
  { name: "Community impact", nominees: 8, color: "bg-accent" },
  { name: "Creative direction", nominees: 5, color: "bg-warning" },
  { name: "Breakthrough project", nominees: 6, color: "bg-success" },
];

export default function Home() {
  return (
    <main
      id="main-content"
      className="min-h-dvh overflow-hidden bg-canvas text-content"
    >
      <nav
        aria-label="Primary navigation"
        className="relative z-20 mx-auto mt-4 flex max-w-7xl items-center justify-between px-4 sm:mt-6 sm:px-6"
      >
        <Link href="/" className="text-xl font-bold" aria-label="AwardOS home">
          AwardOS
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="btn-interactive px-3 py-2 text-sm font-semibold text-content-secondary hover:text-content"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="btn-interactive rounded-md bg-content px-3 py-2 text-sm font-semibold text-canvas hover:bg-content-secondary"
          >
            Create workspace
          </Link>
        </div>
      </nav>
      <section className="relative mx-auto grid min-h-[760px] max-w-7xl items-center gap-16 px-4 pb-24 pt-20 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:pt-16">
        <div className="pointer-events-none absolute -right-16 top-24 size-40 rotate-12 rounded-lg bg-pink/20" />
        <div className="relative z-10 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-accent">
            <Sparkles className="size-4" aria-hidden="true" />
            Every award, under control
          </div>
          <h1 className="max-w-[12ch] text-5xl font-bold text-hero-gradient sm:text-6xl lg:text-7xl">
            Build an award people trust.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-content-secondary">
            Collect nominations, shape the final ballot, verify every vote, and
            publish results from one private command center.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/sign-up"
              className="btn-interactive inline-flex items-center rounded-md bg-accent px-3 py-2 text-base font-semibold text-accent-contrast hover:bg-accent-hover"
            >
              Create your first event{" "}
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Link>
            <span className="inline-flex items-center gap-2 text-sm text-content-secondary">
              <Check className="size-4 text-success" aria-hidden="true" />
              No credit card required
            </span>
          </div>
          <div className="mt-10 flex max-w-lg items-center gap-4 border-t border-border-subtle pt-6 text-sm text-content-secondary">
            <LockKeyhole
              className="size-5 shrink-0 text-content"
              aria-hidden="true"
            />
            Events are never listed publicly. Only people with the
            organizer&apos;s link can reach them.
          </div>
        </div>
        <div
          className="relative min-h-[540px]"
          aria-label="AwardOS event management preview"
        >
          <div className="absolute inset-x-2 top-8 h-[460px] rotate-2 rounded-lg bg-violet/20" />
          <div className="hover-lift relative ml-auto max-w-2xl overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-[0_32px_80px_-32px_rgba(37,99,235,0.35)]">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <div>
                <p className="text-xs font-medium text-content-muted">
                  Event workspace
                </p>
                <p className="mt-1 font-semibold">The Meridian Awards</p>
              </div>
              <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-content-secondary">
                Draft
              </span>
            </div>
            <div className="grid gap-0 md:grid-cols-[0.72fr_1.28fr]">
              <aside className="border-b border-border-subtle bg-surface-muted/60 p-5 md:border-b-0 md:border-r">
                <p className="text-xs font-semibold text-content-muted">
                  Event progress
                </p>
                <ol className="mt-5 space-y-5">
                  {workflow.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm">
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-accent text-accent-contrast" : "bg-surface text-content-muted"}`}
                      >
                        {index === 0 ? <Check className="size-3" /> : index + 1}
                      </span>
                      <span
                        className={
                          index === 0
                            ? "font-semibold text-content"
                            : "text-content-secondary"
                        }
                      >
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </aside>
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-accent">
                      Nominations open
                    </p>
                    <h2 className="mt-1 text-2xl font-bold">
                      Ballot taking shape
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-content">
                      Live intake
                    </p>
                    <p className="text-xs text-content-muted">organizer view</p>
                  </div>
                </div>
                <div className="mt-7 space-y-3">
                  {categories.map((category) => (
                    <div
                      key={category.name}
                      className="rounded-md bg-surface-muted p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`size-2 rounded-full ${category.color}`}
                          />
                          <span className="text-sm font-semibold">
                            {category.name}
                          </span>
                        </div>
                        <span className="text-xs text-content-secondary">
                          {category.nominees} nominees
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border-subtle">
                        <div
                          className={`${category.color} h-full rounded-full`}
                          style={{ width: `${category.nominees * 10}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between rounded-md border border-border-subtle p-4">
                  <div className="flex items-center gap-3">
                    <CircleCheck className="size-5 text-success" />
                    <div>
                      <p className="text-sm font-semibold">
                        Duplicate review ready
                      </p>
                      <p className="text-xs text-content-muted">
                        12 suggestions need your decision
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-content-muted" />
                </div>
              </div>
            </div>
          </div>
          <div className="animate-slide-up absolute -bottom-2 left-0 flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-4 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.35)] sm:left-8">
            <div className="flex size-10 items-center justify-center rounded-md bg-success/10">
              <Fingerprint className="size-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold">Vote verified</p>
              <p className="text-xs text-content-muted">Receipt A7F2 91C4</p>
            </div>
          </div>
        </div>
      </section>
      <section className="border-y border-border-subtle bg-content text-canvas">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="text-sm font-semibold text-[#525252]">
              Private by design
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Your event is not content for our homepage.
            </h2>
            <p className="mt-5 max-w-lg text-base text-[#525252]">
              AwardOS gives each organizer a controlled event link. Choose open
              participation, invitation codes, or email verification without
              placing your audience in a searchable directory.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: LockKeyhole,
                title: "Link only access",
                body: "You decide where the event link appears and who receives it.",
              },
              {
                icon: Users,
                title: "Audience controls",
                body: "Run public, member, alumni, student, or invitation only voting.",
              },
              {
                icon: Fingerprint,
                title: "Verifiable ballots",
                body: "Issue receipts and protect one person, one vote rules.",
              },
              {
                icon: CircleCheck,
                title: "Organizer approval",
                body: "Nothing reaches voting until the complete ballot is reviewed.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-md bg-[#1f1f1f] p-5 text-white">
                <Icon className="size-5 text-[#bdbdbd]" />
                <h3 className="mt-5 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-[#bdbdbd]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <p className="text-sm font-semibold text-accent">
          The award workflow, without the guesswork
        </p>
        <h2 className="mt-5 max-w-4xl text-4xl font-bold text-content-secondary sm:text-5xl">
          Collect the story. Curate the ballot. Publish the moment.
        </h2>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            {
              number: "01",
              title: "Open the right door",
              body: "Share one controlled link with the people who should nominate. Add invitation codes or email verification when the room needs a boundary.",
              color: "bg-accent",
            },
            {
              number: "02",
              title: "Make the hard calls",
              body: "Review every category, resolve duplicate names, and edit the final nominee roster before a single vote is accepted.",
              color: "bg-pink",
            },
            {
              number: "03",
              title: "Leave a clear record",
              body: "Verify ballots, publish the result, and retain the decisions that make the outcome easy to explain later.",
              color: "bg-violet",
            },
          ].map((step) => (
            <article
              key={step.number}
              className="rounded-lg border border-border-subtle bg-surface p-6 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:border-content-muted"
            >
              <span
                className={`inline-flex size-9 items-center justify-center rounded-md ${step.color} text-sm font-bold text-white dark:text-black`}
              >
                {step.number}
              </span>
              <h3 className="mt-7 text-xl font-semibold">{step.title}</h3>
              <p className="mt-3 text-base text-content-secondary">
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="border-y border-border-subtle bg-surface-muted/50">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold text-accent">
              Questions organizers ask
            </p>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              A confident launch starts with clear answers.
            </h2>
          </div>
          <div className="divide-y divide-border-subtle border-y border-border-subtle">
            {[
              [
                "Can I keep an event private?",
                "Yes. Events are reached through organizer shared links, and they are excluded from the sitemap and search indexing.",
              ],
              [
                "Can I change categories after nominations arrive?",
                "Yes. Organizers can edit, deactivate, reorder, import, and export categories while reviewing the event.",
              ],
              [
                "Can I audit the ballot before voting opens?",
                "Yes. Voting is gated until the complete category and nominee roster has been reviewed and approved.",
              ],
              [
                "Do I need a separate voting database?",
                "No. Import existing rosters when needed, or export the event data in spreadsheet and structured formats.",
              ],
            ].map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="cursor-pointer list-none text-base font-semibold text-content marker:hidden">
                  {question}
                  <span className="float-right text-content-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-content-secondary">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <p className="text-sm font-semibold text-accent">
          From idea to official result
        </p>
        <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-bold sm:text-5xl">
          The serious infrastructure behind a memorable award.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-content-secondary">
          Start with a blank event, make every decision yourself, and keep the
          record that proves the outcome.
        </p>
        <Link
          href="/sign-up"
          className="btn-interactive mt-8 inline-flex items-center rounded-md bg-content px-3 py-2 text-base font-semibold text-canvas hover:bg-content-secondary"
        >
          Start building your event <ArrowRight className="ml-2 size-4" />
        </Link>
      </section>
      <footer className="border-t border-border-subtle">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-content-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} AwardOS</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-content">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-content">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
