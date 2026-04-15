FROM node:22-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy all files
COPY . .

# Install dependencies
RUN pnpm install

# Expose port
EXPOSE 3000

# Start backend directly with tsx
CMD ["npx", "tsx", "server/simple/index.ts"]