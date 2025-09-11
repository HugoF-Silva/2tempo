# Backend Dockerfile
FROM node:18-alpine

# Install Python and build dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    build-base \
    linux-headers \
    pcre-dev

# Create Python virtual environment and ensure a python3.12 binary exists in it
RUN python3 -m venv /opt/venv && \
    ln -sf /opt/venv/bin/python /opt/venv/bin/python3.12
# Make sure the venv is used and its site-packages are on the path
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/opt/venv/lib/python3.12/site-packages:${PYTHONPATH}"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY requirements.txt ./

# Install Node dependencies
RUN npm ci

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy serverless config and source code
COPY serverless.yml ./
COPY lambda/ ./lambda/
COPY scripts/ ./scripts/

# Expose ports
EXPOSE 3001 3002

# Start serverless offline
CMD ["npm", "run", "dev"]