# Xion Backend Engine

The backend API engine for **Xion** — an engineering project management platform that snapshot-clones standardized 10-phase software lifecycle workflows into isolated project roadmaps.

## 🚀 Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Language**: TypeScript
- **Framework**: Express.js
- **Database & ORM**: SQLite / PostgreSQL with Prisma ORM v5
- **Validation**: Zod schema validation
- **Authentication**: JWT (JSON Web Tokens) with bcryptjs password hashing
- **Testing**: Vitest integration testing suite
- **Dev Server**: `tsx watch` for instant hot reloading

---

## 🛠️ Key API Features & Endpoints

### 1. Authentication & User Profile (`/api/auth`, `/api/users`)
- `POST /api/auth/login` — Authenticate user and issue JWT token.
- `GET /api/users/profile` — Fetch current user profile.
- `PUT /api/users/profile` — Update name, `@username`, avatar, and password.
- `GET /api/users/check-username?username=...` — Real-time handle availability check (strips `@` prefix, validates characters).
- `GET /api/users/search?query=...` — Live candidate search by name, `@username`, or email.

### 2. Projects & Lifecycle Workflows (`/api/projects`)
- `GET /api/projects` — Fetch accessible personal and team projects.
- `POST /api/projects` — Create project & snapshot-clone 10 global engineering phases & deliverables. Selected team members receive join invitations.
- `GET /api/projects/:id` — Fetch project details, phase roadmap, deliverables, team members, and overall progress.
- `PUT /api/projects/:id` — Update project metadata (Name, Description, Tech Stack, GitHub Repo URL, Live Demo URL, Target Completion Date, Status).
- `PATCH /api/projects/:id/archive` — Toggle project archive status (`ARCHIVED` vs `IN_PROGRESS`). Restricted to Creator / Admin.
- `DELETE /api/projects/:id` — Permanently delete project and cascade phases/deliverables. Restricted to Creator / Admin.
- `POST /api/projects/:id/leave` — Non-creator team members leave project (automatically unassigns pending deliverables).

### 3. Project Join Invitations (`/api/projects/:id/invites`, `/api/invites/:id/respond`)
- `POST /api/projects/:id/invites` — Send join request invitation to `@username`.
- `GET /api/projects/:id/invites` — Fetch pending project join invitations.
- `POST /api/invites/:inviteId/respond` — Accept or decline join request.

### 4. Deliverables & Engineering Metrics (`/api/deliverables`)
- `GET /api/deliverables/my-work` — Get deliverables assigned to logged-in user (filtered by status & sorted by date).
- `PATCH /api/deliverables/:id` — Update status (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED`), document/file URL attachment, assignee, and notes. Triggers dynamic phase progress calculation.

### 5. Notification Engine (`/api/notifications`)
- `GET /api/notifications` — Fetch user notifications & pending join request badges.
- `PATCH /api/notifications/read-all` — Mark notifications as read.

---

## 💻 Getting Started

### 1. Installation & Setup
```bash
cd backend
npm install
```

### 2. Database Migration & Seed
```bash
# Push Prisma schema to SQLite database (dev.db)
npm run db:push

# Generate Prisma Client
npx prisma generate

# Seed initial users, roles, credentials, and 10 engineering workflow templates
npm run seed
```

### 3. Environment Variables
Create a `.env` file in `backend/`:
```env
PORT=5000
JWT_SECRET=xion_jwt_secret_key_development_2026
DATABASE_URL="file:./dev.db"
```

### 4. Running the Backend Server
```bash
# Start dev server with hot reload
npm run dev

# Run Vitest test suite
npm test

# Run TypeScript type check
npm run typecheck
```
