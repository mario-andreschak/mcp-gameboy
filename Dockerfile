# syntax=docker/dockerfile:1
FROM node:lts-alpine

# Install build dependencies for canvas
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install all dependencies (including dev dependencies needed for build)
RUN npm ci

# Copy source code and ROM files
COPY . .

# Make sure the ROM directory exists
RUN mkdir -p roms

# Build TypeScript
RUN npm run build

# Create .env file with default configuration
RUN echo "SERVER_PORT=3001\nROM_PATH=./roms/dangan.gb" > .env

# Default command uses stdio transport
CMD ["node", "dist/index.js"]
