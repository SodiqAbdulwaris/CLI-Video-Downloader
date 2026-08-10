# ── Stage 1: Node build ──────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# VITE_API_BASE_URL is intentionally left unset (empty string) so the frontend
# uses relative /api/* paths. nginx proxies them to the backend on the same
# origin, making the absolute base URL unnecessary in production.
RUN npm run build


# ── Stage 2: nginx static file server ────────────────────────────────────────
# We feed the built static files into the shared reverse-proxy nginx service
# rather than running a second nginx instance here.
# The built output is extracted via a Docker named volume / COPY in Compose.
#
# Choice rationale: serving static files from the *same* nginx that terminates
# TLS and proxies /api/* keeps the service count minimal (one public port,
# one TLS cert location) and avoids an extra proxy hop for static assets.
#
# This final stage is intentionally minimal — its sole purpose is to carry the
# built /app/dist artefacts so Compose can COPY them into the nginx image via
# a multi-stage COPY or a shared volume.

FROM nginx:1.27-alpine AS final

# Remove default nginx config/html; our config and built assets come in via
# the Compose-level bind mounts and volumes.
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy the Vite production build from the node stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443
