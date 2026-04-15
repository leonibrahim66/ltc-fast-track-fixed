FROM node:22-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy only package files first (better install reliability)
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy rest of the project
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["npx", "tsx", "server/simple/index.ts"]