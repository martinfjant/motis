# The app as a container image for Bunny Magic Containers, which only runs
# linux/amd64 images. Build on a Mac with:
#   docker build --platform linux/amd64 -t brf-protokoll .
# Settings are environment variables; see .env.example.

ARG NODE_VERSION=22

# 1. Build: all dependencies, then the production build in .output/.
FROM --platform=linux/amd64 node:${NODE_VERSION}-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 2. Runtime dependencies only. The build bundles everything except libSQL,
#    which has a native part and is loaded from node_modules at runtime.
FROM --platform=linux/amd64 node:${NODE_VERSION}-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

# 3. The image: the build and its runtime dependencies, run as a non-root user.
FROM --platform=linux/amd64 node:${NODE_VERSION}-slim
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
