"use client";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background/5 backdrop-blur-3xl">
      <div className="mx-auto flex max-w-5xl justify-center px-4 py-4 text-xs text-muted-foreground sm:px-6">
        <a
          href="https://x.com/swarooppatilx"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          made by @swarooppatilx
        </a>
      </div>
    </footer>
  );
}
