# Optional: personal subscription feeds (Cloudflare Worker)

GitHub Pages serves static files, so it can only offer **preset** subscriptions: one area × one
stage (or all), with the standard 6-week and 1-week reminders. That already covers most people.

This worker adds what static hosting can't:

- any combination of areas, stages, topics (e.g. ATMP + oncology) and funding types in one feed;
- the subscriber's **own reminder times** (e.g. 8 weeks, 2 weeks, 3 days).

It reads the same `data/opportunities.json` and uses the same `scripts/lib/core.mjs`, so feeds
match the website exactly. Nothing about the subscriber is stored.

## Deploy (about 10 minutes, free tier is enough)

1. Create a Cloudflare account (ideally an Utrecht Holdings one, not a personal one).
2. On a computer with Node.js:
   ```bash
   cd worker
   npx wrangler login
   npx wrangler deploy
   ```
3. Wrangler prints a URL such as `https://uh-funding-feeds.<account>.workers.dev`.
   A custom domain (e.g. `feeds.utrechtholdings.nl`) is better, because subscribers' calendars store
   this URL — set it under the worker's *Domains & Routes* in Cloudflare.
4. Put that URL in `data/config.yaml` → `worker_url`, commit, push. The website now offers a
   subscription for any filter combination and honours custom reminder times.

## URL format

```
/feed.ics?areas=life-sciences,medtech&stages=valorisation&flags=atmp&types=grant&r=56,14,3&entries=1
```

| Parameter | Meaning |
|---|---|
| `areas`, `stages`, `flags`, `types` | Comma-separated keys from `data/taxonomy.yaml`. Empty = all. |
| `r` | Reminder offsets in days before the deadline (max 6, each ≤ 365). Default 42,7. |
| `entries` | `1` (default) adds reminder entries, which Google and Outlook show; `0` relies on alarms only. |
