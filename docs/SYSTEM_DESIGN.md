# System Design

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    Client[React (Vite) Client]
    
    subgraph DevOps [DevOps / Infrastructure]
        Nginx[Nginx Reverse Proxy]
    end
    
    subgraph Backend [Node.js + Express Server]
        API[REST API layer]
        Sockets[Socket.IO Server]
        Services[Service Layer]
    end
    
    subgraph Data [Data Layer]
        Mongo[(MongoDB)]
        Redis[(Redis Cache)]
    end
    
    Client -- "HTTP REST (CRUD)" --> Nginx
    Client -- "WebSocket" --> Nginx
    
    Nginx -- "HTTP /api/*" --> API
    Nginx -- "WS /socket.io/" --> Sockets
    
    API --> Services
    Sockets --> Services
    
    Services -- "Read/Write" --> Mongo
    Services -- "Session Cache" --> Redis
    
    Services -- "Trigger Broadcast" --> Sockets
    Sockets -- "Real-time updates" --> Client
```

## 2. API List (Endpoint + Purpose)

### Auth
- `POST /api/auth/login`: Authenticate user and set JWT in an `HttpOnly` cookie.
- `POST /api/auth/logout`: Clear the JWT cookie.
- `GET /api/auth/me`: Validate JWT (from cookie) and return current user info.

### Users
- `GET /api/users`: List all users (Admin only).
- `POST /api/users`: Create a new user (Admin only).
- `PUT /api/users/:id`: Update a user's details (Admin only).

### Projects
- `GET /api/projects`: List all projects for the current user.
- `GET /api/projects/:id`: Get a specific project's details and its tasks.
- `POST /api/projects`: Create a new project (Admin only).
- `PUT /api/projects/:id`: Update a project's details (Admin only).

### Tasks
- `GET /api/tasks`: List all tasks.
- `POST /api/tasks`: Create a new task within a project.
- `PATCH /api/tasks/:id`: Update a task's status, priority, or details (Triggers Socket emission).
- `DELETE /api/tasks/:id`: Delete a task.

## 3. Database Schema (MongoDB Collections)

- **Users**:
  - `_id`: ObjectId
  - `name`: String
  - `email`: String (Unique)
  - `password`: String (Bcrypt Hash)
  - `role`: String (`Admin`, `Member`)
- **Projects**:
  - `_id`: ObjectId
  - `name`: String
  - `description`: String
  - `ownerId`: ObjectId (Ref: Users)
  - `members`: Array of ObjectId (Ref: Users)
  - `columns`: Array of String (e.g., 'Todo', 'In Progress')
- **Tasks**:
  - `_id`: ObjectId
  - `title`: String
  - `description`: String
  - `status`: String (`Todo`, `In Progress`, `In Review`, `Done`)
  - `priority`: String (`Low`, `Medium`, `High`)
  - `projectId`: ObjectId (Ref: Projects)
  - `assigneeId`: ObjectId (Ref: Users)

## 4. Real-Time Communication Strategy

We use standard REST APIs for incoming actions and Socket.IO purely as a one-way notification channel back to the frontend.
When a user updates a task via `PATCH /api/tasks/:id`, the Express controller updates MongoDB, and then triggers Socket.IO to emit a `TASK_UPDATED` event.

**Room Management Strategy (Explicit Join):**
To ensure efficient memory usage on the server, clients do not join all project rooms on connection. Instead, when a user navigates to a specific Project's Task Board on the frontend, the client emits a `JOIN_PROJECT_ROOM` event (e.g., `room: project_123`). The server subscribes the socket to this room. Real-time task updates for that project are broadcast only to users currently in that room. When the user leaves the page, they emit a `LEAVE_PROJECT_ROOM` event.

## 5. Input Validation & Error Handling

- **Input Validation**: Kept lightweight and dependency-free. Validation is performed manually inside the Express controllers (e.g., checking if `status` or `priority` strings match allowed ENUMs).
- **Centralized Error Handling**: A global Express error-handling middleware catches all thrown errors and manual validation failures, ensuring the frontend always receives a consistent JSON structure (e.g., `{ success: false, message: "..." }`).

## 6. Why this approach was chosen

- **Normalized Database**: Separating Tasks from Projects prevents MongoDB document size limits and array-mutation race conditions when multiple users update tasks simultaneously.
- **REST for Writes, Sockets for Reads**: Keeping writes in standard REST controllers allows us to use standard HTTP status codes, middleware, and error handling. Sockets are reserved strictly for pushing state changes, reducing complexity on the client side.
- **State Management (Redux + RTK Query)**: Redux Toolkit (RTK) Query is chosen for the frontend state management. It provides robust out-of-the-box handling for API data caching, loading, and error states, ensuring a clean API abstraction layer. To handle real-time WebSockets, Socket.IO events will be integrated to manually patch the RTK Query cache (streaming updates), maintaining a single source of truth for the UI state while ensuring instant reactivity.

## 7. Scalability Considerations

- **Redis**: For the MVP, Redis is used strictly as a fast, in-memory cache for `User` objects (keyed by the `userId` decoded from stateless JWTs). This prevents database hits on every socket connection and repeated API calls while keeping authentication completely stateless.
- **Future Scaling**: If we scale the backend to multiple instances horizontally, we will add Redis as a Socket.IO Pub/Sub adapter. This will ensure that real-time events triggered on Server A are successfully broadcast to clients connected to Server B.
