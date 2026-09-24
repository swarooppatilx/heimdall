import { siteConfig } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl justify-center px-4 py-2 text-xs text-muted-foreground sm:px-6">
        <a
          href={siteConfig.author.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 transition-colors hover:text-foreground"
        >
          made by {siteConfig.author.name}
        </a>
      </div>
    </footer>
  );
}
