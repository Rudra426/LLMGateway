# LLMGate

A gateway that sits between an application and an LLM provider API. The application sends its requests to the
gateway instead of the provider, and the gateway applies per-key rate limits and daily budgets, caches
identical requests, and logs every call. A small dashboard shows usage, cost and blocked requests.


## Why it exists

Calls to an LLM API cost money and are rate limited. A bug or a heavy user can use up a budget quickly, and
repeated identical questions are paid for again each time. LLMGate puts those controls in one place, in front
of any app that uses the API.

## How a request is handled

```
App ──► Gateway ──► LLM provider
         │
         ├─ 1. Authenticate the API key (stored hashed)
         ├─ 2. Rate limit per key (per minute)
         ├─ 3. Check the key's daily budget
         ├─ 4. Look up the cache ── hit: return the stored answer (no provider call, no cost)
         ├─ 5. Reserve a worst-case cost against the budget
         ├─ 6. Call the provider (one retry on a temporary failure)
         ├─ 7. Calculate the real cost from the provider's usage data and settle the reservation
         └─ 8. Write a log entry (buffered, never blocks the response)
```

Redis holds the rate-limit counters, daily spend and cached answers. MongoDB holds API keys and request logs.

## Features

- API keys per app or user, stored as hashes, each with its own rate limit and daily budget
- Fixed-window rate limit per key (default 60 requests per minute)
- Daily budget per key (default ₹50). A worst-case cost is reserved before each provider call, so parallel
  requests cannot all pass the check at once
- Exact-match response cache. A request is cached only when `temperature` is set and is at most 0.5, and not
  when it uses tools or streaming. The response headers `X-Cache` (HIT, MISS or BYPASS) and
  `X-LLMGate-Cost-INR` show what happened
- Providers and per-model prices come from `gateway/src/config/providers.json`. The provider is chosen with
  the optional request header `x-llmgate-provider`, otherwise `DEFAULT_PROVIDER` is used
- One retry after a temporary provider failure. A rate-limit response from the provider is passed on as a 429
  marked `upstream rate limited`, so it can be told apart from the gateway's own limits
- Admin API and dashboard (Overview, Keys, Logs) protected by an admin token
- Sample app with a switch between the mock provider and Gemini

## Repository layout

| Folder | What it is |
|---|---|
| `gateway/` | The gateway (Node.js, Express, MongoDB, Redis) |
| `dashboard/` | Admin dashboard (React, Vite, Tailwind, Recharts) |
| `sample-app/` | Small demo app that asks questions through the gateway |
| `mock-llm/` | Fake provider with a fixed 500 ms delay, used for testing without cost |

## Run it locally

You need Node.js, a MongoDB instance and a Redis instance.

**1. Mock provider** (port 4000)
```
cd mock-llm
npm install
npm start
```

**2. Gateway** (port 3000)
```
cd gateway
npm install
copy .env.example .env      (macOS/Linux: cp .env.example .env)
```
Fill in the values in `.env`, then:
```
npm start
```

**3. Dashboard**
```
cd dashboard
npm install
copy .env.example .env
npm run dev
```
Open the address Vite prints and log in with the `ADMIN_TOKEN` from the gateway's `.env`. Set the gateway's
`DASHBOARD_ORIGIN` to that address. Create an API key on the **Keys** page. The key is shown only once.

**4. Sample app** (port 4100 by default)
```
cd sample-app
npm install
copy .env.example .env
npm start
```
Put the key you created into `SAMPLE_APP_API_KEY`.

## Environment variables

Names only. Values go in each folder's `.env`, which is not committed.

| Folder | Variables |
|---|---|
| gateway | `PORT`, `DEFAULT_PROVIDER`, `MOCK_LLM_URL`, `GEMINI_BASE_URL`, `GEMINI_API_KEY`, `MONGO_URI`, `REDIS_URL`, `CACHE_TTL_SECONDS`, `ADMIN_TOKEN`, `DASHBOARD_ORIGIN`, `RESERVE_DEFAULT_MAX_TOKENS`, `DNS_SERVERS` |
| dashboard | `VITE_GATEWAY_URL` (read at build time) |
| sample-app | `PORT`, `GATEWAY_URL`, `SAMPLE_APP_API_KEY`, `SAMPLE_APP_MODEL` |
| mock-llm | `PORT` |

`DNS_SERVERS` is optional. It exists for local networks that cannot resolve `mongodb+srv://` addresses. Leave
it unset when deploying.

## API

**Proxy** (send the gateway key as `Authorization: Bearer <key>`)

| Method and path | Purpose |
|---|---|
| `POST /v1/chat/completions` | Same request format as OpenAI-compatible chat completions |
| `GET /health` | Health check |

**Admin** (send the admin token in the `x-admin-token` header)

| Method and path | Purpose |
|---|---|
| `GET /admin/keys` | List keys with today's spend |
| `POST /admin/keys` | Create a key (returned once) |
| `DELETE /admin/keys/:id` | Revoke a key |
| `GET /admin/logs?limit=50&keyId=` | Latest requests |
| `GET /admin/stats?range=7d` | Totals and daily figures (`1d`, `7d`, `30d`) |

## Benchmark results

Measured with a load test against the mock provider (fixed 500 ms delay). MongoDB and Redis ran in local Docker
containers, and the load generator, the mock and the gateway ran on the same laptop. This was one run of
3 × 30 seconds, so the figures show the order of magnitude and are not a general performance claim.

| Measurement | Result |
|---|---|
| Mock provider called directly, p50 | 512 ms |
| Through the gateway, cache miss, p50 | 531 ms (about 19 ms added) |
| Through the gateway, cache hit, p50 / p99 | 8 ms / 14 ms |
| 200-prompt replay with 40% exact repeats | 40% hit rate (equal to the repeats in the workload) |
| Rate limit set to 60 per minute, 100 requests sent | 60 allowed |
| 60 requests at the end of one minute and 60 at the start of the next | 120 allowed |
| 50 parallel requests against a small budget | The budget was never exceeded (1 allowed, 49 blocked) |

## Deploying

Each folder deploys as its own service. Set secrets in the hosting platform's environment settings, never in
the repository. Follow the platform's current documentation for the exact menu steps.

| Service | Root folder | Build | Start | Notes |
|---|---|---|---|---|
| mock-llm | `mock-llm` | `npm ci` | `npm start` | Only needed if the mock provider should be online. `PORT` is usually set by the host. |
| gateway | `gateway` | `npm ci` | `npm start` | See the settings below. |
| dashboard | `dashboard` | `npm run build` | static site, output folder `dist` | `VITE_GATEWAY_URL` is read at build time, so set it before the build runs. |
| sample-app | `sample-app` | `npm ci` | `npm start` | Needs a key created in the dashboard. |

Gateway settings to check:

- `MONGO_URI` and `REDIS_URL`. Use the `rediss://` form for a Redis service that requires TLS. Allow the
  host's outbound address in MongoDB's network access settings.
- `ADMIN_TOKEN`: a new long random value, never reused from development.
- `DASHBOARD_ORIGIN`: exactly the dashboard's public URL, otherwise the browser blocks the admin calls.
- `MOCK_LLM_URL`: the mock service's URL, if the mock provider is used.
- `DEFAULT_PROVIDER`, `GEMINI_BASE_URL`, `GEMINI_API_KEY`, `CACHE_TTL_SECONDS`, `RESERVE_DEFAULT_MAX_TOKENS`.
- Leave `DNS_SERVERS` unset.

Deploy order: mock, gateway, dashboard, then set `DASHBOARD_ORIGIN` on the gateway, create a key in the
dashboard, and deploy the sample app with that key. Check `GET /health` on the gateway, then ask the same
question twice in the sample app: the second answer should come from the cache.

Free hosting tiers may sleep when idle, so the first request after a pause can be slow.

## Known limitations

- The fixed-window rate limit allows up to twice the limit around a window boundary.
- The budget reserves a worst-case estimate before each call, so it can block a request that would have fit.
  If Redis times out while a request is finishing, that reservation can stay counted until the day's spend key
  expires.
- The cache matches identical requests only, and is shared between API keys.
- Responses are not streamed.
- Request logs are buffered in memory for a few seconds, so a hard crash can lose them.
- If Redis is unavailable, the rate limit, the budget and the cache are skipped and requests still go through.
- Prices are read from a file at startup. Gemini's standard price changes on 1 January 2027, so update
  `providers.json` and its `_pricesCheckedOn` date.
- Latency percentiles in the dashboard use the most recent 10,000 non-blocked requests in the selected range.
- Tested manually against one real model, `<model name from providers.json>`. Other OpenAI-compatible
  providers can be added in `providers.json` but are untested.


## About how this was built

I designed the architecture and requirements and tested the behavior. I used AI coding tools for much of the
implementation, and I can explain and demonstrate each part.