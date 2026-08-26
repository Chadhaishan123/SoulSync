FROM node:24-alpine

WORKDIR /app

# Copy package config and install dependencies
COPY package.json ./
RUN npm install

# Copy application source
COPY . .

# Expose Next.js default port
EXPOSE 3000

# Run Next.js in development mode
CMD ["npm", "run", "dev"]
