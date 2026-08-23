import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";

const GITHUB_URL = "https://github.com/swarooppatilx/heimdall";

export function GitHubLink() {
  return (
    <Button variant="ghost" size="icon" asChild>
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub repository">
        <HugeiconsIcon icon={GithubIcon} />
      </a>
    </Button>
  );
}
