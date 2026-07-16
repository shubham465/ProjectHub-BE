# Project Management Backend

This is the backend for the Internal Project Management System. It is built using Node.js, Express, MongoDB, and Redis. It also uses Socket.io for real-time features.

## Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (running locally or a cloud URI)
- [Redis](https://redis.io/) (running locally or a cloud URL)

### Running Services Locally (Optional)

If you need to run MongoDB and Redis locally, the easiest way is using Docker:

```bash
# Run MongoDB locally
docker run -d --name local-mongo -p 27017:27017 mongo

# Run Redis locally
docker run -d --name local-redis -p 6379:6379 redis
```

Alternatively, on macOS you can use Homebrew:
```bash
brew install redis mongodb-community
brew services start redis
brew services start mongodb-community
```

## Getting Started

Follow these steps to set up and run the backend server:

### 1. Install Dependencies

Navigate to the `backend` directory and install the necessary npm packages:

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

The application requires several environment variables to run properly.

1. Create a `.env` file in the root of the `backend` directory:
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file and verify/update the values. The default `.env.example` looks like this:
   ```env
   MONGO_URI=mongodb://localhost:27017/project_management
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your_super_secret_key_change_in_production
   JWT_EXPIRES_IN=7d
   PORT=5000
   NODE_ENV=development
   ```
   *Make sure MongoDB and Redis are running at the URLs provided in your `.env` file.*

### 3. Start the Server

You can start the server in two ways:

**Development Mode** (uses `--watch` to automatically restart the server on file changes):
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

If everything is configured correctly, you should see logs indicating that the server is running and successfully connected to MongoDB and Redis.

## Testing

To run the automated tests using Jest:

```bash
npm test
```

## Deployment on Render

When deploying this backend to [Render](https://render.com/), you must configure the following **Environment Variables** in your Render dashboard:

- `MONGO_URI`: The connection string to your production MongoDB Atlas cluster.
- `REDIS_URL`: The connection string to your production Upstash Redis instance (use the `rediss://` format if TLS is required).
- `JWT_SECRET`: A strong, randomly generated secret for signing JSON Web Tokens.
- `JWT_EXPIRES_IN`: Duration for the JWT (e.g., `7d` or `24h`).
- `CLIENT_ORIGIN`: The URL of your deployed frontend (e.g., `https://projecthub-fe.vercel.app`). This is critical for CORS.
- `NODE_ENV`: Set to `production`.

*Note: You do not need to provide a `PORT` variable manually on Render, as Render will automatically inject it and the application will listen to `process.env.PORT`.*
