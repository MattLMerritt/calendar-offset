# Use a lightweight Node image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package config and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy your code
COPY server.js .

# Default environment variables
ENV PORT=3000

# Open the port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
