# Use Node.js LTS version
FROM node:20-alpine

# Install OpenSSL and other dependencies for Prisma
RUN apk add --no-cache libc6-compat openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including Prisma)
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy application source code
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Cloud Run sets the PORT environment variable
# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
