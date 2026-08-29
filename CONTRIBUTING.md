# Contributing to Heimdall

Contributions are welcome, whether a bug fix, a new ATS provider, or a documentation improvement.

## Table of Contents

- [Local development](#local-development)
- [Checks](#checks)
- [Testing](#testing)
- [Coding conventions](#coding-conventions)
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

To seed the empty database with live listings while `npm run dev` is running:

```bash
curl -X POST "http://localhost:3000/api/crawl/trigger?slices=16" \
  -H "x-crawl-trigger-token: change-me"
```

Each slice crawls part of the registry; 16 slices covers every board.

## Checks

Run all of these before opening a pull request:

```bash
npx tsc --noEmit   # typecheck
npx biome check .  # lint
npx knip           # unused code
npm test           # tests
npx next build     # production build
```

A Husky pre-commit hook runs lint-staged, typecheck, and the tests automatically, so a commit that fails the checks will not land.

## Testing

- Unit tests live next to the code they cover (`*.test.ts`) and run under Vitest
- Provider parsers keep their own fixtures (see the `src/lib/providers/` tests)
- New behavior should land with a test; bug fixes should land with a test that fails before the fix

## Coding conventions

The codebase is TypeScript in strict mode. Beyond that, the rules are short:

- Short, focused, deterministic functions with descriptive, domain-oriented names
- No magic numbers, no dead code, no commented-out code
- No premature abstraction. Add structure when real code needs it, not before
- Match the style of the surrounding code; feature-first file layout over generic utility buckets

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

## Codebase overview

The app runs as a single Worker (via the OpenNext adapter) with a cron-triggered crawler and root-rendered API routes.

- `worker/index.ts`: Worker entry point, request routing and the scheduled crawl
- `src/app/`: Next.js pages and API routes (jobs, filters, crawl status)
- `src/db/`: Drizzle schema (migrations live under `drizzle/`)
- `src/lib/providers/`: one parser per ATS
- `src/lib/registry.json` + `src/lib/registry.ts`: the curated registry of company boards the crawler reads
- `src/lib/crawler.ts`: slices the registry and runs a fetch pass per tick
- `src/lib/normalize.ts`, `diff.ts`, `job-writes.ts`: normalize, dedupe, diff, and persist listings to D1
- `src/lib/jobs-kv.ts`, `cache-kv.ts`, `facets.ts`: KV response caches (`all-jobs` with a 300s TTL, `facet-options`, `rl:` rate-limit counters)
- `src/lib/employment.ts`, `experience.ts`, `gazetteer.ts`, `department.ts`: field normalization and remote/region detection

How a crawl works: the cron (`*/30 * * * *`) computes the current sweep tick out of `TICKS_PER_SWEEP = 16`, takes the registry slice for that ordinal, and fetches each board. Rows are normalized, diffed against what D1 already has, and upserted. Listings older than `FRESHNESS_DAYS` are hidden from results, and the API serves from the KV caches before falling back to D1.

## Adding a new ATS provider

The quickest way to add a provider is to copy the shape of an existing one; `src/lib/providers/lever.ts` and `ashby.ts` are the smallest.

1. Create `src/lib/providers/<name>.ts`: a parse function (or async fetcher) that maps the ATS's raw listing into the `Job` shape from `src/lib/job.ts`. `id`, `title`, `company`, `location`, and `url` are required. Let `detectExperienceLevel` infer a level from the title (`src/lib/experience.ts`) when the ATS provides none, and detect remote via the gazetteer (`resolvePlace` in `src/lib/gazetteer.ts`) instead of string matching in the provider.
2. Add `src/lib/providers/<name>.test.ts` with fixtures mirroring the raw ATS payload, asserting the mapped `Job` fields.
3. Add one entry per company board to `src/lib/registry.json`, with `provider: "<name>"` and `apiUrl` when the ATS exposes one.
4. Run the [Checks](#checks).

Keep the fetch budget in mind: an invocation allows 35 external subrequests, so a sweep tick processes roughly 31 boards. The registry is near its ceiling (~500 boards). Prefer the one-request-per-board pattern the existing providers use over per-listing requests, and when in doubt, ask in the PR.

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
| `CRAWL_STATUS_TOKEN` | Optional. If set, `GET /api/crawl/status` requires it. Leave unset for the open status readout the homepage footer depends on. |

In production these are set with `npx wrangler secret put CRAWL_TRIGGER_TOKEN`; leave the trigger unset for a crawler that only runs on the cron.

### Bindings provisioned per account

| Binding | Type | Provisioning |
| --- | --- | --- |
| `DB` | D1 database `heimdall` | `npx wrangler d1 create heimdall --binding DB --update-config` |
| `CACHE` | KV namespace | `npx wrangler kv namespace create heimdall-cache --binding CACHE --update-config` |
| `ANALYTICS` | Analytics Engine dataset `heimdall` | None; the dataset auto-creates on the first write after deploy |
| `ASSETS` | OpenNext asset serving | Automatic (created by the OpenNext build) |

Rate limiting runs per-IP through the `CACHE` KV namespace as a sliding window under an `rl:` key prefix, falling back to in-process memory in a sandbox without KV. No separate rate-limit namespace is provisioned.

`--binding` and `--update-config` make wrangler write the produced ID straight into `wrangler.jsonc`, so there is no manual copy-paste. D1 also accepts a placement hint, e.g. `--location wnam`. Run `npx wrangler types` (`npm run cf-typegen`) after any change to regenerate `cloudflare-env.d.ts`.

## API

| Endpoint | Rate limit | Notes |
| --- | --- | --- |
| `GET /api/jobs` | 100/min | Job search with filters, `limit` (max 500), `offset` (max 10000) |
| `GET /api/filters` | 30/min | Facet options for the filter UI |
| `GET /api/crawl/status` | 30/min | Crawl diagnostics |
| `POST /api/crawl/trigger` | 30/min | Manual crawl, `x-crawl-trigger-token` header. 401 unless configured. |

`GET /api/jobs` accepts `q`, `company`, `location`, `city`, `country`, `department`, `source`, `early_career`, `experience`, `posted` (`today` or `week`), and `sort`. Responses are a JSON array of jobs; the total count is in the `X-Total-Count` header.

```bash
curl "https://heimdall.daenerys.workers.dev/api/jobs?q=rust&posted=week&limit=10"
```

```json
[
  {
    "id": "greenhouse_8137843002",
    "title": "Senior Rust Engineer",
    "company": "Example Corp",
    "location": "Remote, United States",
    "department": "Engineering",
    "url": "https://boards.greenhouse.io/example/jobs/8137843002",
    "postedAt": "2026-08-28T12:00:00.000Z",
    "source": "greenhouse",
    "experienceLevel": "senior",
    "isRemote": true
  }
]
```

Fields trimmed for readability. A job also carries `salary`, `locations`, `isEarlyCareer`, and (when present) `city`/`country`. The full shape is `Job` in `src/lib/job.ts`.

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