
# Build stage
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
# Install only production dependencies
RUN npm install --production

# Copy build artifacts and server file
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/services ./services
COPY --from=build /app/firebase.ts ./firebase.ts
COPY --from=build /app/types.ts ./types.ts

# Install ts-node to run the server file directly in production (simplest for now)
RUN npm install -g ts-node typescript

EXPOSE 8080

ENV PORT=8080

# In Cloud Run, the service account credentials are automatically provided
CMD ["ts-node", "--esm", "--skipProject", "server.ts"]
