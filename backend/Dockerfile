FROM node:18-alpine

WORKDIR /app

# Install git because backend clones repositories
RUN apk add --no-cache git

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Railway provides PORT automatically, this is fallback
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]