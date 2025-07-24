# syntax=docker/dockerfile:1
FROM node:20-alpine AS frontend-builder

WORKDIR /app/react

# Copy package files
COPY react/package*.json ./
RUN npm install --force

# Copy frontend source and build
COPY react/ ./
RUN npx vite build

# Python runtime stage
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install system dependencies including curl for healthcheck
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install dependencies
COPY server/requirements.txt ./server/
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy server code
COPY server/ ./server/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/react/dist ./react/dist

# Set environment variables
ENV UI_DIST_DIR=/app/react/dist
ENV HOST=0.0.0.0

# Run the application
WORKDIR /app/server
CMD ["python", "main.py", "--host", "0.0.0.0", "--port", "8088"]
