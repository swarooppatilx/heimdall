"use client";

import { GitHubLink } from "@/components/github-link";
import { ThemeToggle } from "@/components/theme-toggle";

type HeaderProps = {
  left?: React.ReactNode;
  right?: React.ReactNode;
};

function DefaultLeft() {
  return (
    <div className="flex items-center gap-1 pt-4">
      <img
        src={"logo_dark.svg"}
        height={128}
        width={128}
        alt="Heimdall Logo"
        className="h-14 w-14 -mt-1 hidden dark:block"
      />
      <img
        src={"logo_light.svg"}
        height={128}
        width={128}
        alt="Heimdall Logo"
        className="h-14 w-14 -mt-1 dark:hidden"
      />
      <div className="flex flex-row items-baseline gap-3 -ml-2">
        <h1 className="text-xl font-semibold tracking-tight">heimdall</h1>

        <span className="hidden text-sm text-muted-foreground sm:inline">
          fresh tech jobs, direct from source
        </span>
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
    <header className="sticky top-0 z-10 border-b border-border/40 bg-background/5 backdrop-blur-3xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {left ?? <DefaultLeft />}
        {right ?? <DefaultRight />}
      </div>
    </header>
  );
}
