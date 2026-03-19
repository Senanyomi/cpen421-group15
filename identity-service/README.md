# NERDCP — Identity & Authentication Service (Phase 2)

A production-ready Identity and Authentication microservice for the National Emergency Response and Dispatch Coordination Platform.

---

## Features

| Feature | Detail |
|---|---|
| Register | Creates account, returns access + refresh tokens |
| Login | Validates credentials, issues token pair |
| Token Refresh | Rotates refresh token, issues new access token |
| Logout | Revokes refresh token(s) from DB |
| Get Profile | Returns authenticated user's data |
| Update Profile | Updates name and/or email |
| List Users | Admin: paginated user list with filters |
| Deactivate User | Admin: soft-disable, revokes all sessions |
| Reset Password | Two-step: request token → confirm with new password |

---

## Tech Stack

- **Node.js** + **Express.js**
- **PostgreSQL** via **Prisma ORM**
- **bcryptjs** — password hashing (12 rounds)
- **jsonwebtoken** — short-lived access tokens (15m) + long-lived refresh tokens (7d)
- **RabbitMQ** (amqplib) — publishes auth events to `nerdcp.events` exchange
- **express-rate-limit** — brute-force protection on auth endpoints

---

## Folder Structure

```
identity-service/
├── prisma/
│   ├── schema.prisma       # DB schema (User, RefreshToken, PasswordResetToken)
│   └── seed.js             # Creates default admin user
├── src/
│   ├── controllers/
│   │   └── auth.controller.js    # Thin HTTP layer — calls service
│   ├── middleware/
│   │   ├── auth.middleware.js    # JWT verify + role guard
│   │   ├── error.middleware.js   # Global error handler + asyncHandler
│   │   └── rateLimiter.middleware.js
│   ├── routes/
│   │   └── auth.routes.js        # All route declarations
│   ├── services/
│   │   └── auth.service.js       # All business logic
│   ├── utils/
│   │   ├── jwt.js                # Token generation/verification
│   │   ├── logger.js             # Console logger
│   │   ├── prisma.js             # Prisma client singleton
│   │   └── rabbitmq.js           # Event publisher
│   ├── validators/
│   │   └── auth.validators.js    # Input validation (no extra libs)
│   └── index.js                  # App entry point
├── .env.example
├── .gitignore
└── package.json
```

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- RabbitMQ 3+ (optional — service starts without it)

### Step 1 — Clone and install

```bash
cd identity-service
npm install
```

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
PORT=3001
DATABASE_URL="postgresql://postgres:password@localhost:5432/nerdcp_identity?schema=public"
JWT_ACCESS_SECRET="replace-with-a-long-random-string"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="replace-with-a-different-long-random-string"
JWT_REFRESH_EXPIRES_IN="7d"
RABBITMQ_URL="amqp://localhost:5672"
BCRYPT_ROUNDS=12
NODE_ENV=development
```

> **Important:** Use different secrets for access and refresh tokens.

### Step 3 — Create the database

```bash
# Using psql
createdb nerdcp_identity

# Or via psql prompt
psql -U postgres -c "CREATE DATABASE nerdcp_identity;"
```

### Step 4 — Run migrations

```bash
npm run db:generate   # generates the Prisma client
npm run db:migrate    # applies schema to the database
```

### Step 5 — Seed the database (optional)

Creates a default admin user (`admin@nerdcp.gov` / `Admin@1234`):

```bash
npm run db:seed
```

> Change the admin password immediately after first login.

### Step 6 — Start the service

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

The service starts at: `http://localhost:3001`

---

## API Reference

Base URL: `http://localhost:3001`

All responses follow this shape:
```json
{ "success": true | false, "message": "...", "data": { ... } }
```

---

### POST /auth/register

Creates a new user and returns a token pair.

**Body:**
```json
{
  "name": "Kwame Mensah",
  "email": "kwame@nerdcp.gov",
  "password": "Secure@123",
  "role": "OPERATOR"
}
```

Valid roles: `ADMIN`, `DISPATCHER`, `OPERATOR`, `RESPONDER`, `ANALYST`

**Response 201:**
```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "user": { "id": "uuid", "name": "Kwame Mensah", "email": "kwame@nerdcp.gov", "role": "OPERATOR" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

---

### POST /auth/login

**Body:**
```json
{ "email": "kwame@nerdcp.gov", "password": "Secure@123" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

---

### POST /auth/refresh-token

Exchange a valid refresh token for a new token pair. The old refresh token is invalidated.

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

**Response 200:**
```json
{
  "success": true,
  "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
}
```

---

### POST /auth/logout

🔒 Requires: `Authorization: Bearer <accessToken>`

Revoke the provided refresh token. If `refreshToken` is omitted, **all sessions** for the user are revoked.

**Body (optional):**
```json
{ "refreshToken": "eyJ..." }
```

---

### GET /auth/profile

🔒 Requires: `Authorization: Bearer <accessToken>`

**Response 200:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Kwame Mensah", "email": "kwame@nerdcp.gov", "role": "OPERATOR", "isActive": true }
}
```

---

### PUT /auth/profile

🔒 Requires: `Authorization: Bearer <accessToken>`

**Body (all fields optional):**
```json
{ "name": "Kwame A. Mensah", "email": "kwame.new@nerdcp.gov" }
```

---

### GET /auth/users

🔒 Requires: `Authorization: Bearer <accessToken>` | Role: `ADMIN`

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |
| `role` | string | Filter by role |
| `isActive` | boolean | Filter by active status |

**Response 200:**
```json
{
  "success": true,
  "data": [ { "id": "...", "name": "...", "email": "...", "role": "...", "isActive": true } ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "pages": 3 }
}
```

---

### PUT /auth/users/:id/deactivate

🔒 Requires: `Authorization: Bearer <accessToken>` | Role: `ADMIN`

Soft-deactivates the user and revokes all their active sessions.

**Response 200:**
```json
{ "success": true, "message": "User kwame@nerdcp.gov has been deactivated." }
```

---

### POST /auth/reset-password

**Step 1 — Request a reset token:**

```json
{ "email": "kwame@nerdcp.gov" }
```

In **development**, the `resetToken` is returned in the response.  
In **production**, it should be emailed to the user.

---

### POST /auth/reset-password/confirm

**Step 2 — Set a new password:**

```json
{
  "token": "uuid-from-step-1",
  "newPassword": "NewSecure@456"
}
```

**Response 200:**
```json
{ "success": true, "message": "Password has been reset successfully. Please log in again." }
```

---

## Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character (`!@#$%^&*` etc.)

---

## RabbitMQ Events Published

| Routing Key | Trigger |
|---|---|
| `user.registered` | New user created |
| `user.logged_in` | Successful login |
| `user.logged_out` | Logout |
| `user.deactivated` | Admin deactivates a user |
| `user.password_reset_requested` | Reset token generated |

All events go to the `nerdcp.events` topic exchange.

---

## Security Notes

- Passwords are hashed with bcrypt (12 rounds — ~250ms per hash)
- Refresh tokens are stored in the database and revoked on logout
- Access tokens are short-lived (15 min) — compromise window is small
- Timing-safe comparison prevents email enumeration on login
- Rate limiting: 20 requests/15 min on auth endpoints
- Password reset tokens expire after 1 hour and can only be used once
