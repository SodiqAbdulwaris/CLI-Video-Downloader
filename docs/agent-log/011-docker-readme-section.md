# 011: Expand the README's Docker section into a full walkthrough

The Docker section from the README rewrite (007) covered the two commands to build and stop the stack, but left out enough detail for someone actually setting Docker up for the first time: no mention of copying `.env`, no way to confirm the backend actually started, no explanation of what each mounted volume is for, and no guidance on rebuilding after a code change. Expanded it into a numbered setup walkthrough (prerequisites, `.env`, build and start, health check, start the frontend), a common-commands table, a volumes table, and short notes on rebuilding and stopping.

Every command in the new section was run against a real container, not just written from reading `compose.yaml`:

- `cp .env.example .env`, set `DOWNLOADS_ROOT_HOST` to a real absolute Windows path, `docker compose up -d --build`.
- `curl http://127.0.0.1:8000/health` returned `{"status":"ok"}`.
- `docker compose config` correctly resolved `DOWNLOADS_ROOT_HOST` to the path set in `.env`.
- Set the download location in the app to match, triggered a real download through the containerized backend, and confirmed the file landed on the actual host filesystem, not just inside the container.
- `docker compose down`, confirmed containers were removed.

## Verification
- Full documented setup sequence run start to finish against a real Docker Desktop instance.
- Scanned the updated section for em dashes, en dashes, and emoji: none found, consistent with the rest of the README.
