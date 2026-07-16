# ProjectHub - Backend & Project Documentation

This repository houses the backend services for **ProjectHub**, a Real-Time Internal Project Management System. The project is split into frontend and backend repositories. This document serves as the primary documentation hub for the entire project's deliverables.

## Deliverables Checklist
- [x] **GitHub Repository (Backend):** [https://github.com/shubham465/ProjectHub-BE](https://github.com/shubham465/ProjectHub-BE)
- [x] **GitHub Repository (Frontend):** [https://github.com/shubham465/ProjectHub-FE](https://github.com/shubham465/ProjectHub-FE)
- [x] **Deployed Backend URL:** [https://projecthub-be.onrender.com](https://projecthub-be.onrender.com)
- [x] **Deployed Frontend URL:** [https://project-hub-fe.vercel.app](https://project-hub-fe.vercel.app)
- [x] **Planning & Design Documents:** See `CONTEXT.md` in the root repository.
- [ ] **Loom Video:** (Out of Scope)

---

## AI Usage Declaration (Mandatory)
AI (Antigravity/Gemini) was used as a pair-programming assistant to accelerate the generation of boilerplate code (such as CRUD routes and React components), assist with configuring the Socket.io integration, and refine the deployment setup. All AI-generated code was actively reviewed, tested, and is fully understood by the developer.

---

## Architecture Overview
ProjectHub is built on a standard MERN stack architecture (MongoDB, Express, React, Node.js), separated into two distinct repositories to isolate concerns and allow independent deployments.

- **Frontend:** A React application utilizing Context API/React state for local state management, styled with Tailwind CSS, and hosted on Vercel for fast, edge-cached delivery.
- **Backend:** A Node.js/Express application acting as a RESTful API and WebSocket server, hosted on Render.
- **Database:** MongoDB (Atlas) for persistent storage.
- **Cache:** Redis is utilized to cache frequently accessed data, like user sessions, to minimize database hits.
- **Real-time Sync:** Socket.IO establishes a persistent connection between clients and the backend to broadcast task updates in real-time.

---

## Design Decisions & Trade-offs
1. **Hosting Strategy:** We deployed the frontend to Vercel and the backend to Render. Render was chosen for the backend to support long-lived WebSocket connections (Socket.IO), which are often restricted or unsupported in serverless environments like Vercel functions.
2. **Real-time Synchronization:** We utilized `Socket.io` for instant task updates instead of HTTP polling. While this adds complexity to the infrastructure and deployment, it prioritizes cross-user real-time state consistency, which is crucial for a project management tool.
3. **Performance Optimization:** We implemented Redis for user session caching to minimize repetitive MongoDB queries, effectively trading a slightly more complex infrastructure setup for faster API response times.
4. **Security/Authentication:** We rely on `HttpOnly` cookies for JWT transmission instead of `localStorage` to mitigate XSS vulnerabilities, ensuring secure authentication.

---

## API Reference

### Auth
- `POST /api/auth/login` - Authenticate a user and set HttpOnly cookie.
- `GET /api/auth/me` - Retrieve the currently authenticated user.
- `POST /api/auth/logout` - Clear authentication cookies and Redis cache.

### Users
- `GET /api/users/` - List all users.
- `POST /api/users/` - Create a new user.
- `PUT /api/users/:id` - Update an existing user.

### Projects
- `POST /api/projects/` - Create a new project (Admin only).
- `GET /api/projects/` - List all projects for the authenticated user.
- `GET /api/projects/:id` - Retrieve a specific project.
- `PUT /api/projects/:id` - Update a project (Admin only).

### Tasks
- `GET /api/tasks/` - List tasks (filterable by project).
- `POST /api/tasks/` - Create a new task in a project.
- `PATCH /api/tasks/:id` - Update a task's status or details.
- `DELETE /api/tasks/:id` - Delete a task.

---

## Socket Events Reference

**Client Emits (to Server):**
- `JOIN_PROJECT_ROOM` (Payload: `{ projectId }`) - Join a specific project's WebSocket room.
- `LEAVE_PROJECT_ROOM` (Payload: `{ projectId }`) - Leave a specific project's WebSocket room.

**Server Emits (to Client in Room):**
- `TASK_CREATED` (Payload: `{ task }`) - Broadcasted when a new task is created in the project.
- `TASK_UPDATED` (Payload: `{ task }`) - Broadcasted when a task's details or status is changed.
- `TASK_DELETED` (Payload: `{ task }`) - Broadcasted when a task is removed.

---

## Local Setup (Backend)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/shubham465/ProjectHub-BE.git
   cd ProjectHub-BE
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   REDIS_URL=your_redis_connection_string
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=7d
   CLIENT_ORIGIN=http://localhost:5173
   NODE_ENV=development
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

5. **Testing:**
   To run automated tests using Jest:
   ```bash
   npm test
   ```

## Deployment on Render
When deploying this backend to [Render](https://render.com/), configure the following Environment Variables in your Render dashboard:
- `MONGO_URI`: The connection string to your production MongoDB Atlas cluster.
- `REDIS_URL`: The connection string to your production Redis instance.
- `JWT_SECRET`: A strong, randomly generated secret for signing JSON Web Tokens.
- `JWT_EXPIRES_IN`: Duration for the JWT (e.g., `7d` or `24h`).
- `CLIENT_ORIGIN`: The URL of your deployed frontend (e.g., `https://project-hub-fe.vercel.app`). This is critical for CORS.
- `NODE_ENV`: Set to `production`.

*Note: You do not need to provide a `PORT` variable manually on Render, as Render will automatically inject it.*
