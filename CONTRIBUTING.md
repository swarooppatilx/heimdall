# Contributing to Heimdall

Contributions are welcome, whether a bug fix, a new ATS provider, or a documentation improvement.

## Table of Contents

- [Local development](#local-development)
- [Checks](#checks)
- [Testing](#testing)
- [Coding conventions](#coding-conventions)
- [UI conventions](#ui-conventions)
- [Commits](#commits)
- [Pull requests](#pull-requests)
- [Codebase overview](#codebase-overview)
- [Adding a new ATS provider](#adding-a-new-ats-provider)
- [Configuration](#configuration)
- [API](#api)
- [Docs & references](#docs--references)
- [Questions & etiquette](#questions--etiquette)

## Local development

Clone and install:

```bash
git clone https://github.com/swarooppatilx/heimdall.git
cd heimdall
npm install
npm run db:migrate:local   # create the schema in the local database
cp .dev.vars.example .dev.vars
npm run dev
```

The dev server emulates every binding from `wrangler.jsonc` in-process (D1, KV) and reads local secrets from `.dev.vars`. Nothing touches your Cloudflare account; the only live calls a crawl makes are to the company ATS endpoints. Analytics Engine telemetry is skipped locally. The binding is absent, so the tracking calls no-op.

To seed the empty database with live listings, run the built worker locally. Crawls go through a queue, and only `wrangler dev` runs the queue consumer (`next dev` does not):

```bash
npm run preview            # builds the worker and serves it on http://localhost:8787
curl -X POST "http://localhost:8787/api/crawl/trigger?slices=4" \
  -H "x-crawl-trigger-token: change-me"
```

Each slice is a quarter of the registry; 4 slices covers every board. The trigger only enqueues, and the local consumer crawls eight boards per message.

## Checks

Run all of these before opening a pull request:

```bash
npx tsc --noEmit --incremental false   # typecheck (a stale tsbuildinfo can hide errors)
npx biome check .                      # lint + format
npx knip                               # unused files, exports, dependencies
npx next build                         # production build
npm test                               # tests, including real D1 integration tests
```

A Husky pre-commit hook runs lint-staged, typecheck, and the tests automatically, so a commit that fails the checks will not land.

## Testing

- Unit tests live next to the code they cover (`*.test.ts`) and run under Vitest
- Provider parsers keep their own fixtures (see the `src/server/crawl/providers/` tests)
- New behavior should land with a test; bug fixes should land with a test that fails before the fix

## Coding conventions

The codebase is TypeScript in strict mode. Beyond that, the rules are short:

- Short, focused, deterministic functions with descriptive, domain-oriented names
- No magic numbers, no dead code, no commented-out code
- No premature abstraction. Add structure when real code needs it, not before
- Match the style of the surrounding code; feature-first file layout over generic utility buckets

## UI conventions

The UI is built from shadcn/ui primitives in `src/components/ui/` (style `radix-maia`, icons from Hugeicons). Those files are vendored: keep them close to upstream so `npx shadcn@latest add <name> --diff` stays readable, and add new primitives with the CLI rather than by hand. Lint and knip are relaxed for that folder only.

Components and styling:

- Reach for an existing primitive before writing markup: `Button`, `Badge`, `Kbd`, `Skeleton`, `Empty`, `Field`, `ToggleGroup`, `InputGroup`
- Customize in this order: a built-in `variant`/`size`, then `className` for layout only (margins, width, flex), then a new `cva` variant in the primitive, then a wrapper component. Never override a primitive's colors or typography at the call site
- Colors come from semantic tokens (`text-muted-foreground`, `bg-primary`, `text-warning`). No raw palette colors and no hand-written `dark:` pairs; add a variable to `globals.css` instead
- Spacing uses `flex`/`grid` with `gap-*`, never `space-x-*`/`space-y-*`; `size-*` when width equals height
- Stick to the theme scale. A size you need twice becomes an `@theme` token (`text-2xs`), not an arbitrary value
- `cn()` for conditional classes; no `z-*` on overlays, they stack themselves
- Two to seven mutually exclusive options are a `ToggleGroup`; labelled controls sit in `FieldGroup`/`Field`
- Icons inside a `Button` take `data-icon="inline-start"` or `"inline-end"` and no sizing classes
- Shapes follow the radix-maia style: controls and filters are pills (the primitives' own radii), cards are `rounded-lg`, and the search box is the one squarer, raised surface (`rounded-xl bg-card`)

Interaction and copy:

- Every focusable element shows a `focus-visible` ring; never ship `outline-none` without a replacement
- Inputs are at least 16px on mobile so iOS doesn't zoom (`text-base md:text-sm`)
- Buttons grow on touch screens through `pointer-coarse:` sizes in `ui/button.tsx`; don't shrink them back at the call site
- A popup's trigger gets focus back with `refocusWithoutScroll`, so closing a menu never scrolls the page
- Use the ellipsis character `…` in placeholders and loading text
- Status is never color alone; the text says it too
- Loading, empty, and error states are all designed, and each offers a next step
- Markup used in more than one place becomes a component (for example `SkipLink`)
- Copy is lowercase throughout; that is the house style

## Commits

One logical change per commit, one-liner only, no scope:

```text
feat: add ashby provider
fix: handle missing location
refactor: simplify job entity
test: add search tests
docs: update readme
```

The commits follow the [conventional commits](https://www.conventionalcommits.org) spec

## Pull requests

- Start from an issue. For a feature, open an issue and settle the design before writing code
- Keep each PR to one logical change; a provider lands as its own PR
- Heimdall only reads official company career pages and their ATS providers, never aggregators. A PR that scrapes LinkedIn, Indeed, or similar will not merge
- If a change affects users or self-hosters, update the README in the same PR
- Every PR from a branch in this repo gets a Workers Preview at `https://pr-<number>-heimdall.<subdomain>.workers.dev`, posted as a PR comment and deleted when the PR closes. Previews have their own database and never run the crawler; run `npm run preview:branch` to make one by hand

## Codebase overview

The app runs as a single Worker (via the OpenNext adapter) that serves the site and API, runs the cron tick, and consumes the crawl queue. Code is split by where it runs:

```
migrations/        D1 schema changes, applied by wrangler in file-name order
worker/            Worker entry (fetch, scheduled, queue) and edge-cache purge
src/
├── app/           routes only: pages, route handlers, metadata
├── components/    React UI: ui/ (shadcn primitives), layout/, jobs/
├── hooks/         client hooks for the search page
├── lib/           pure code safe in the browser: Job and search-param types, helpers
└── server/        Worker-only code: anything that touches D1, KV, fetch, or env
    ├── api/       route wrapper, rate limits, token auth, cache headers
    ├── db/        Drizzle client and schema
    ├── crawl/     scheduler, queue, per-board crawl, fetch budget and retries, crawl status, registry
    │   └── providers/   one parser per ATS
    ├── jobs/      search queries, writes, facets, cached KV views
    └── locations/ gazetteer and location normalization
```

`components/`, `hooks/`, and `lib/` must not import from `server/`; Biome fails the lint if they do. Shared response shapes live in `src/lib/api-types.ts`.

Each board's latest crawl lives in `board_status`, keyed `provider/name`: status, consecutive empty crawls (drift), the last response validator (an `ETag`, else `Last-Modified`; the next fetch sends it as `If-None-Match` or `If-Modified-Since`, and a 304 skips the board), and when it last changed data.

How a crawl works: the cron (`*/30 * * * *`) picks the registry slice for the current tick (`TICKS_PER_SWEEP = 4`, so every board is crawled every two hours) and enqueues it on `heimdall-crawl`, eight boards per message. The queue consumer fetches each board, normalizes and diffs the rows against D1, and upserts them, recording whether anything changed. On the next tick, if any crawl changed data, the cron rebuilds the KV views and purges the `jobs` cache tag, so pages and API responses refill from D1. Listings older than `FRESHNESS_DAYS` are hidden from results.

## Adding a new ATS provider

The quickest way to add a provider is to copy the shape of an existing one; `src/server/crawl/providers/lever.ts` and `ashby.ts` are the smallest.

1. Create `src/server/crawl/providers/<name>.ts`: a zod schema for one posting (make anything the ATS can omit or send as `null` `.nullish()`; the response envelope only checks the list is an array, and `mapPostings` validates postings one by one so a bad one is skipped, not the board), and a parse function (or async fetcher) that maps the ATS's raw listing into the `Job` shape from `src/lib/job.ts`. `id`, `title`, `company`, `location`, and `url` are required. Pass location text through untouched with `postingLocations()` from `src/server/locations/gazetteer.ts`; ingest canonicalizes it once with `resolvePlace` (folded names, remote detection). If the ATS has an explicit remote flag, set `isRemote` from it; ingest keeps it.
2. Add `src/server/crawl/providers/<name>.test.ts` with fixtures mirroring the raw ATS payload, asserting the mapped `Job` fields.
3. Register the fetcher in the `PROVIDERS` map in `src/server/crawl/fetch-jobs.ts` with a two-letter `idPrefix`. Job ids must start with `<idPrefix>-<board>-`; the crawler finds a board's stored jobs by that prefix.
4. Boards live in the D1 `sources` table (`board` is `provider/name`). Add one with `INSERT OR IGNORE INTO sources (board, provider, name, label)` in a new migration, so fresh databases get it too; `src/server/crawl/sources.seed.json` is the list that migration 0025 was built from. Setting `status = 'dead'` stops crawling a board.
5. Run the [Checks](#checks).

Keep the budget in mind: each queue message gets 35 subrequests for its eight boards, and fetches and D1 calls share them (the Free plan allows 50 per invocation). A provider can afford a few requests per board but not one per listing; when a board runs out mid-pagination it should return what it fetched with `complete: false`, as SmartRecruiters does. The registry scales with queue operations instead: 937 boards make about 118 messages per sweep, roughly 1,400 messages and 4,250 queue operations a day, against 10,000 on the free plan. Prefer the one-request-per-board pattern the existing providers use, and when in doubt, ask in the PR.

## Configuration

Heimdall reads configuration from three places: public vars in `wrangler.jsonc`, secrets for local dev in `.dev.vars`, and Cloudflare bindings.

### Vars in `wrangler.jsonc`

Shipped with the Worker and visible in the repo:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Optional fallback for the canonical site URL (sitemap, robots, JSON-LD). Normally derived from the request host. |
| `FRESHNESS_DAYS` | How many days a job stays visible before it expires. |
| `NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN` | Cloudflare Web Analytics beacon token (public by design, embedded in the browser beacon). |

### Secrets: `.dev.vars` locally, secrets in production

Not visible in the repo: see `.dev.vars.example`.

| Secret | Purpose |
| --- | --- |
| `CRAWL_TRIGGER_TOKEN` | Authorizes `POST /api/crawl/trigger`. Without it the endpoint always returns 401. |

In production these are set with `npx wrangler secret put CRAWL_TRIGGER_TOKEN`; leave the trigger unset for a crawler that only runs on the cron.

### Bindings provisioned per account

| Binding | Type | Provisioning |
| --- | --- | --- |
| `DB` | D1 database `heimdall` | `npx wrangler d1 create heimdall --binding DB --update-config` |
| `CACHE` | KV namespace | `npx wrangler kv namespace create heimdall-cache --binding CACHE --update-config` |
| `CRAWL_QUEUE` | Queue `heimdall-crawl` (producer and consumer) | `npx wrangler queues create heimdall-crawl` |
| `ANALYTICS` | Analytics Engine dataset `heimdall` | None; the dataset auto-creates on the first write after deploy |
| `ASSETS` | OpenNext asset serving | Automatic (created by the OpenNext build) |

Rate limiting uses the three `ratelimits` bindings (`JOBS_`, `FILTERS_`, `STATUS_RATE_LIMITER`), falling back to in-process memory where they are absent. Their `namespace_id` values are identifiers you choose, not provisioned resources.

Previews use their own D1 database and KV namespace, declared in the `previews` block of `wrangler.jsonc` (`heimdall-preview` and `heimdall-preview-cache`). The preview database is also the `preview_database_id` of `DB`, so `npx wrangler d1 migrations apply DB --remote --preview` migrates it.

`--binding` and `--update-config` make wrangler write the produced ID straight into `wrangler.jsonc`, so there is no manual copy-paste. D1 also accepts a placement hint, e.g. `--location wnam`. Run `npx wrangler types` (`npm run cf-typegen`) after any change to regenerate `cloudflare-env.d.ts`.

## API

| Endpoint | Rate limit | Notes |
| --- | --- | --- |
| `GET /api/jobs` | 100/min | Job search with filters, `limit` (max 500), `offset` (max 10000) |
| `GET /api/filters` | 30/min | Facet options for the filter UI |
| `GET /api/sync` | 30/min | Time of the latest crawl, for the "updated" label |
| `GET /llms-full.txt` | 100/min | The 200 most recent jobs as plain text, for LLM crawlers |
| `POST /api/crawl/trigger` | 30/min | Manual crawl, `x-crawl-trigger-token` header. 401 unless configured. |

`GET /api/jobs` accepts `q`, `company`, `location`, `city`, `country`, `department`, `level` (`intern`, `entry`, `mid`, `senior` or `lead`), `posted` (`today` or `week`), and `sort` (`newest` or `company`; without it a search is ordered by best match, anything else newest first). Responses are a JSON array of jobs with `id`, `title`, `company`, `location`, `url`, `source`, `postedAt` (ISO 8601), and `salary` when known. The capped total (`1000` means 1000 or more) is in the `X-Total-Count` header of the first page (`offset` 0) only.

```bash
curl "https://heimdall.daenerys.workers.dev/api/jobs?q=rust&posted=week&limit=10"
```

```json
[
  {
    "id": "gh-example-8137843002",
    "title": "Senior Rust Engineer",
    "company": "example",
    "location": "remote, united states",
    "url": "https://boards.greenhouse.io/example/jobs/8137843002",
    "source": "greenhouse",
    "postedAt": "2026-08-28T12:00:00.000Z"
  }
]
```

This is the whole public shape (`JobDto` in `src/lib/job.ts`); `salary` appears when the ATS provides one. Location facets and flags stay server-side, where filtering happens.

## Docs & references

- Drizzle ORM (schema, queries, migrations): https://orm.drizzle.team/docs
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare KV: https://developers.cloudflare.com/kv/
- Workers Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Workers Analytics Engine: https://developers.cloudflare.com/analytics/analytics-engine/
- OpenNext for Cloudflare: https://opennext.js.org/cloudflare and https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- Biome: https://biomejs.dev
- Vitest: https://vitest.dev
- Next.js App Router: https://nextjs.org/docs

## Questions & etiquette

Ask questions in a GitHub issue or on a pull request rather than privately, so the answer is on the record. Maintainers answer on their own time.