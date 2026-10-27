# ---- dependencies (shared by the stages below) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- tests: docker compose run --rm test ----
FROM deps AS test
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY test ./test
CMD ["sh", "-c", "npm test && npm run test:e2e"]

# ---- build ----
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime (default target): only the compiled code and production dependencies ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
