interface QuoteCardProps {
  text: string;
  domain?: string | null;
}

export function QuoteCard({ text, domain }: QuoteCardProps) {
  return (
    <blockquote className="relative rounded-[var(--radius-card)] border border-outline-variant/20 bg-surface-container px-6 py-8 sm:px-10 sm:py-10">
      <span
        className="news-title absolute left-4 top-2 text-6xl leading-none text-primary-container/30 select-none sm:left-6 sm:text-7xl"
        aria-hidden
      >
        “
      </span>
      <p className="news-title relative z-[1] text-xl leading-relaxed text-on-surface sm:text-2xl">
        {text}
      </p>
      {domain && (
        <footer className="metrics-font mt-6 text-xs uppercase tracking-widest text-on-surface-variant">
          {domain}
        </footer>
      )}
    </blockquote>
  );
}
