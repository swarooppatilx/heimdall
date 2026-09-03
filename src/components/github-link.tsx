import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

export function GitHubLink() {
  return (
    <Button variant="ghost" size="icon" asChild>
      <a
        href={siteConfig.github}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub repository"
      >
        <HugeiconsIcon icon={GithubIcon} />
      </a>
    </Button>
  );
}
