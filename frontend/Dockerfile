# Build context is the repo root (see docker-compose.yml): the frontend imports the shared
# schemas and fixtures from ../shared at build time, like the backend does at run time.

# Stage 1: build the static bundle.
FROM node:22-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY shared /app/shared
COPY frontend .
# In compose the frontend calls the backend through the nginx /api proxy (Phase 8).
ARG VITE_BACKEND_URL=http://localhost:8000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build

# Stage 2: serve it with nginx. The SPA fallback sends unknown paths to index.html and
# /api/ is proxied to the backend container.
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
