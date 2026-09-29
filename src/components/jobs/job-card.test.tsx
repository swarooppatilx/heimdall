// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { JobCard } from "@/components/jobs/job-card";
import type { JobDto } from "@/lib/job";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const job: JobDto = {
  id: "gh-stripe-1",
  title: "Platform Engineer",
  company: "stripe",
  location: "berlin, germany",
  url: "https://boards.greenhouse.io/stripe/jobs/1",
  postedAt: "2026-10-01T09:00:00.000Z",
  source: "greenhouse",
};

describe("JobCard", () => {
  it("links the whole card to the posting and names it for screen readers", () => {
    render(<JobCard job={job} openings={1} />);

    const apply = screen.getByRole("link", { name: "Apply to Platform Engineer at stripe" });
    expect(apply.getAttribute("href")).toBe(job.url);
    expect(screen.getByRole("link", { name: "stripe" }).getAttribute("href")).toBe(
      "/company/stripe",
    );
  });

  it("drops the company link on the company's own page", () => {
    render(<JobCard job={job} openings={1} showCompany={false} />);

    expect(screen.queryByRole("link", { name: "stripe" })).toBeNull();
  });

  it("spells out repeat openings and machine-readable posting time", () => {
    const { container } = render(<JobCard job={job} openings={3} />);

    expect(screen.getByText("3 openings")).toBeTruthy();
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(job.postedAt);
  });
});
