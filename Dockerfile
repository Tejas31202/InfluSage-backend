# Node.js LTS image
FROM node:20

# Set working directory inside container
WORKDIR /app

# Copy package.json & package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install -g nodemon
RUN npm install

# Copy all source code
COPY . .

# Expose backend port
EXPOSE 3001

# Start backend with nodemon (hot reload)
CMD ["npx", "nodemon", "app.js"]
