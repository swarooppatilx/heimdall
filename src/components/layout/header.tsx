import { GitHubLink } from "@/components/layout/github-link";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface HeaderProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
}

function DefaultLeft() {
  return (
    <div className="flex items-center gap-1">
      {/* decorative: the heading beside it carries the name */}
      <Logo size={56} className="-ml-2 size-14" />
      <div className="-ml-2 flex flex-col gap-0.5">
        <h1 className="font-display text-xl leading-none font-semibold tracking-tight">heimdall</h1>
        <span className="text-2xs text-muted-foreground">fresh tech jobs, direct from source</span>
      </div>
    </div>
  );
}

function DefaultRight() {
  return (
    <div className="flex items-center gap-1">
      <GitHubLink />
      <ThemeToggle />
    </div>
  );
}

export function Header({ left, right }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 h-header border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4 sm:px-6">
        {left ?? <DefaultLeft />}
        {right ?? <DefaultRight />}
      </div>
    </header>
  );
}
