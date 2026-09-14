# syntax=docker/dockerfile:1

# ---------- base ----------
FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- dev (hot reload) ----------
FROM base AS dev
ENV VITE_USE_POLLING=1
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---------- build de producao ----------
FROM base AS build
COPY . .
RUN npm run build

# ---------- runtime de producao ----------
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
