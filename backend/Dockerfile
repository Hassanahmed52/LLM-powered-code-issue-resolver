FROM node:18-alpine
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --production

# Copy source
COPY . .

# Use an unprivileged port for Cloud Run
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV PORT 8080
EXPOSE 8080
CMD ["node", "server.js"]