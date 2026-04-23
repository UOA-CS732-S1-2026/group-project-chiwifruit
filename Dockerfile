# syntax=docker/dockerfile:1

# Use Debian-based Node image for better native module compatibility and lower maintenance overhead than Alpine.
FROM node:20-bookworm-slim

WORKDIR /app

# Install workspace dependencies first for layer caching.
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm ci

# Copy the rest of the repository, including client/server source and assets.
COPY . .

ENV NODE_ENV=development \
    PORT=3000 \
    FRONTEND_ORIGIN=http://localhost:5173

EXPOSE 3000 5173

# Run frontend and backend together for local container development.
CMD ["npx", "concurrently", "-c", "cyan.bold,magenta.bold", "npm run dev --workspace=client -- --host 0.0.0.0 --port 5173", "npm run dev --workspace=server"]
