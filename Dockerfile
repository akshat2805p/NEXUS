FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM golang:1.18-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/go.mod go.sum ./
RUN go mod download
COPY backend/ .
RUN go build -o nexus-backend .

FROM alpine:latest

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=backend-builder /app/backend/nexus-backend .
COPY --from=frontend-builder /app/frontend/dist ./dist

EXPOSE 8080

CMD ["./nexus-backend"]
