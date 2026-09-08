FROM node:20-bookworm-slim

WORKDIR /app

# Install native build tools for modules like bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

# Automatically hash any plaintext passwords in DB on startup, then launch server
CMD ["sh", "-c", "node hash_passwords.js || true; npm start"]
