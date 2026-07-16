# Functional Requirement Document (FRD)

## 1. Core Features
- **Authentication**: Secure user login via JWT. Socket connections are also authenticated.
- **User Management (Admin Panel)**: Dedicated interface for administrators to view, add, and manage user accounts.
- **Project Management**: Dashboard to view the project list, create, and manage projects.
- **Task Management (Task Board)**: Visual board to create, assign, and update tasks within a project.
- **Real-Time Updates**: Instant synchronization of task statuses and properties across all connected users via WebSockets.
- **Task Properties**: Title, Description, Status (Todo, In Progress, In Review, Done), Priority (Low, Medium, High), Assignee, and Project ID.
- **Error & Loading Handling**: Graceful error feedback and loading states across the application UI.

## 2. User Roles & Permissions
- **Admin**: Full workspace management; can create/delete projects and invite users.
- **Member**: Standard user; can view assigned projects, create tasks, and update task statuses.

## 3. Assumptions
- Users are invited or created by an Admin (no self-serve public registration).
- Tasks are singular units of work (no sub-tasks or complex dependencies).
- Passwords are securely hashed (bcrypt) prior to storage.
- All API endpoints and socket events require valid authentication.
- Input validation and centralized error handling are enforced at the backend.

## 4. Out-of-Scope Items
- File attachments on tasks.
- Email, Slack, or Push notifications (only in-app real-time socket updates).
- Complex activity logs and historical audit trails.
- Custom task workflows or columns.
