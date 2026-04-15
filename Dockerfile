FROM node:22-slim
# Cache-bust ARG — increment CACHE_BUST to force Railway's registry-level cache
# to invalidate. Referenced in a RUN below so the layer actually re-executes
# (a bare ARG without a consumer doesn't always bust downstream layers).
ARG CACHE_BUST=1
RUN echo "Railway cache-bust marker: ${CACHE_BUST}"
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["node", "server.js"]
