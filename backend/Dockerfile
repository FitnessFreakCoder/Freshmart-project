# Use a lightweight Node version
FROM node:20-slim

WORKDIR /app

# Copy package files first (better for caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

EXPOSE 5000
CMD ["npm", "start"]