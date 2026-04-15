FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build
# Cache-bust ARG — placed AFTER npm ci + build so bumping CACHE_BUST only
# invalidates this single trivial layer. npm ci stays cached when package-lock.json
# is unchanged, and COPY . . stays cached when source files are unchanged — but
# Railway's registry-level cache is still broken because the Dockerfile content
# changes when CACHE_BUST changes. Bump the default value (1 → 2 → 3...) only
# when Railway is serving a stale image. Normal deploys need no bump.
ARG CACHE_BUST=1
RUN echo "Railway cache-bust marker: ${CACHE_BUST}"
CMD ["node", "server.js"]
