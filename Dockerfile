
# Build stage
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Build frontend
RUN npm run build
# Build backend using dedicated config
RUN npm run build:server

# Production stage
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

# Copy build artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

EXPOSE 8080
ENV PORT=8080

# Run the compiled javascript
CMD ["node", "dist-server/server.js"]
