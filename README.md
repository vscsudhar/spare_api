# VoltSpare Backend API

Production-ready backend architecture for VoltSpare motorcycle/EV parts store, built with Node.js, Express, MongoDB, and Mongoose.

## Tech Stack
* Core: Node.js, Express.js
* Database: MongoDB, Mongoose
* Security: Helmet, CORS, Express Rate Limit, Mongo Sanitize, BcryptJS, JWT
* Validation: Zod
* File Handling: Multer
* Testing: Jest, Supertest
* Code Style: ESLint, Prettier

## Prerequisites
* Node.js v18+
* MongoDB running locally (default: `mongodb://127.0.0.1:27017/voltspare`)

## Quickstart
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment variables and adjust as needed:
   ```bash
   cp .env.example .env
   ```
3. Run development server (with nodemon):
   ```bash
   npm run dev
   ```
4. Run tests:
   ```bash
   npm run test
   ```
5. Run lint & formatting checks:
   ```bash
   npm run lint
   npm run format
   ```
