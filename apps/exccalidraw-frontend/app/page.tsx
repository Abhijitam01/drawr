import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { SITE } from "./lib/site";

function BentoCard({
  title,
  description,
  className,
  children,
  style,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md animate-fade-up dark:border-zinc-800 dark:bg-zinc-950 ${className ?? ""}`}
    >
      <div className="relative">
        <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </div>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative">
      {/* subtle background */}
      <div className="pointer-events-none absolute inset-x-0 top-[-140px] mx-auto h-[420px] max-w-6xl px-5">
        <div className="absolute left-10 top-10 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl animate-float-slow" />
        <div className="absolute right-10 top-24 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl animate-float-slow" />
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pt-20">
        {/* Hero: clarify purpose */}
        <section className="mx-auto max-w-3xl text-center">
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 shadow-sm animate-fade-in dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            style={{ animationDelay: "50ms" }}
          >
            <span className="font-medium">Draw</span>
            <span className="text-zinc-400">•</span>
            <span>hand-drawn diagrams & quick sketches</span>
          </div>

          <h1
            className="mt-6 text-balance text-4xl font-semibold leading-tight tracking-tight animate-fade-up sm:text-6xl"
            style={{ animationDelay: "120ms" }}
          >
            A minimal whiteboard for thinking out loud.
          </h1>

          <p
            className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-zinc-600 animate-fade-up dark:text-zinc-300"
            style={{ animationDelay: "180ms" }}
          >
            {SITE.name} is an Excalidraw-style drawing app. Use it to sketch flows,
            wireframes, and ideas — fast.
          </p>

          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-3 animate-fade-up"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/draw"
              className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Open editor
            </Link>
            <Link
              href="#features"
              className="rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              What can I do?
            </Link>
          </div>

          <div
            className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-600 animate-fade-up dark:text-zinc-400"
            style={{ animationDelay: "300ms" }}
          >
            <span>Shapes</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span>Arrows</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span>Text</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span>Export</span>
          </div>
        </section>

        {/* Bento grid: fewer cards, less text */}
        <section id="features" className="mt-12 scroll-mt-24 sm:mt-14">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Everything you need — nothing you don’t
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              A focused toolset for quick diagrams.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5">
            <BentoCard
              className="md:col-span-4"
              title="Sketch fast"
              description="Drop shapes, connect with arrows, and keep iterating."
              style={{ animationDelay: "80ms" }}
            >
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-black">
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Untitled board</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
                    autosaved
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
                  <div className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
                </div>
                <div className="mt-3 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
              </div>
            </BentoCard>

            <BentoCard
              className="md:col-span-2"
              title="Export"
              description="PNG/SVG for docs, slides, and sharing."
              style={{ animationDelay: "140ms" }}
            />

            <BentoCard
              className="md:col-span-3"
              title="Shareable boards"
              description="Use rooms/links so others can join your sketch."
              style={{ animationDelay: "200ms" }}
            />

            <BentoCard
              className="md:col-span-3"
              title="Keyboard-first"
              description="Shortcuts for speed (tools, duplicate, align, nudge)."
              style={{ animationDelay: "260ms" }}
            />
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="/draw"
              className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Start drawing now
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
