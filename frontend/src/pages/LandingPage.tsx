import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import type { FeedItem } from "@/lib/types";
import { FeedCard } from "@/components/ui/FeedCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { EXTENSION_URL } from "@/utils/constants";

const STEPS = [
  {
    n: "01",
    title: "Clip it",
    body: 'Right-click any video, podcast, or selected text → "Clip it".',
  },
  {
    n: "02",
    title: "Trim and take a stand",
    body: "Trim to 90 seconds or 100 words, write your take.",
  },
  {
    n: "03",
    title: "Share and debate",
    body: "Share the landing page and debate it in the open.",
  },
];

export function LandingPage() {
  const [newest, setNewest] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .feed({ limit: 6, offset: 0, sort: "new" })
      .then((res) => {
        if (!cancelled) setNewest(res.items);
      })
      .catch(() => {
        if (!cancelled) setNewest([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[680px] -translate-x-1/2 rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,122,0,0.28) 0%, rgba(255,192,122,0.08) 45%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="news-title text-5xl font-bold tracking-tight text-primary sm:text-6xl md:text-7xl"
          >
            Annotated
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45 }}
            className="mt-5 text-lg text-on-surface-variant sm:text-xl"
          >
            Clip it. Comment on it. Back it up.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a
              href={EXTENSION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-xl bg-primary-container px-6 py-3 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98]"
            >
              Get the Chrome extension
            </a>
            <Link
              to="/feed"
              className="inline-flex rounded-xl border border-outline-variant/40 px-6 py-3 text-sm font-medium text-on-surface transition-colors hover:border-primary-container/40"
            >
              Browse the feed
            </Link>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <h2 className="news-title mb-8 text-center text-2xl font-semibold text-on-surface sm:text-3xl">
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="rounded-[var(--radius-card)] border border-outline-variant/15 bg-surface-container p-6"
            >
              <span className="metrics-font text-xs text-primary-container">
                {step.n}
              </span>
              <h3 className="news-title mt-3 text-xl font-semibold text-on-surface">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Newest annotations */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="news-title text-2xl font-semibold text-on-surface">
            Newest annotations
          </h2>
          <Link
            to="/feed?sort=new"
            className="text-sm text-on-surface-variant hover:text-primary"
          >
            View all
          </Link>
        </div>

        {!loaded ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-[var(--radius-card)] bg-surface-container"
              />
            ))}
          </div>
        ) : newest.length === 0 ? (
          <EmptyState
            title="The feed is quiet"
            description="Install the extension, clip something you care about, and spark the first debate."
            cta="extension"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {newest.map((item) => (
              <FeedCard key={item.id} item={item} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
