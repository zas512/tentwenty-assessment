# Contest Participation API

A TypeScript + Express + Prisma backend for running contests where authenticated users can join contests, answer questions, receive scores, view leaderboards, and claim prizes.

This repository implements the backend requirements from the assessment:

- authenticated APIs for Guest, User, VIP, and Admin flows
- role-based access control
- contest participation, scoring, and leaderboard tracking
- user participation history and prizes
- PostgreSQL database schema and migrations
- Postman collection with working API examples
- rate limiting and centralized API error handling

## Setup

### Prerequisites

- Node.js 20 or newer recommended
- PostgreSQL database
- npm

### 1. Install dependencies

```bash
npm install
```

### 2. Create the environment file

Create a `.env` file in the project root with the required values.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
JWT_SECRET="replace_with_a_long_random_access_secret"
JWT_REFRESH_SECRET="replace_with_a_long_random_refresh_secret"
PORT=5000
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
NODE_ENV="development"
```

### 3. Run the database migration

If you are starting from a fresh database, apply the existing Prisma migration:

```bash
npx prisma migrate deploy
```

For local development after schema changes, you can also use:

```bash
npx prisma migrate dev
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Seed the database

```bash
npm run seed
```

### 6. Start the API

Development mode:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Flow Details

The system is built around four main flows:

1. Authentication flow
2. Contest discovery and question retrieval flow
3. Contest participation and scoring flow
4. Leaderboard, prizes, and history flow

All protected APIs use cookie-based JWT authentication. Guests are also authenticated, but they receive a guest role and a separate identity.

## Project Overview

The rest of this document explains the access model, data model, API surface, and supporting setup in more detail.

## Roles and Access

The application supports four roles:

- `ADMIN`: full access to all endpoints and admin actions
- `VIP`: access to VIP contests plus normal contests
- `USER`: access to normal contests
- `GUEST`: authenticated guest access with normal contest permissions

### Access Rules

- All contest APIs are authenticated.
- Guest users can browse normal contests, join normal contests, submit answers, and view their own history.
- VIP contests are restricted to `ADMIN` and `VIP`.
- Draft contests and draft questions are restricted to admins.
- Admin users can create, update, and delete contests and questions, and can also manage user roles.

## How the Flow Works

### 1. Authentication

A client signs in through one of these paths:

- register a normal user
- login with email/password
- request a guest session

The server responds with HTTP-only access and refresh cookies. The access token is used by the authentication middleware to identify the user on subsequent requests.

### 2. Contest Discovery

Once authenticated, the client can list contests and open a contest by ID.

Contest access is filtered by role:

- normal users and guests see normal contests
- VIP users and admins can see VIP contests
- draft contests stay hidden from non-admins

### 3. Question Retrieval

After opening a contest, the client requests its questions. Question endpoints are also authenticated, and the server blocks access to VIP-only contests unless the user has the correct role.

### 4. Join Contest

The user joins a contest before submitting answers. The server checks:

- contest exists
- contest is active
- current time is inside the contest window
- role is allowed for that contest access level
- the user has not already joined

### 5. Submit Answers and Score

The user submits answers as a list of question IDs and selected option IDs.

The server validates:

- the request contains answers
- each question is answered only once
- each selected option belongs to the correct question
- single-select and true/false questions receive exactly one selected option
- the contest is active and not expired
- the user joined the contest first

Scoring rules:

- a question score is added only when the selected options match the correct options exactly
- each question contributes its configured points value
- the final score is stored on the participation record and leaderboard entry

### 6. Leaderboard and Prize Awarding

After submission:

- the leaderboard is recalculated by score
- ranks are updated in order
- the top-ranked participant is awarded the contest prize
- prize records are kept in sync with the current winner

### 7. User History

Authenticated users can inspect:

- full participation history
- in-progress participations
- prizes they have won

## Tech Stack

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JSON Web Tokens
- bcrypt
- helmet, compression, cors
- rate-limiter-flexible

## Repository Structure

- `src/server.ts` - application bootstrap and middleware pipeline
- `src/routes/` - route registration
- `src/controllers/` - API handlers
- `src/middlewares/` - auth, authorization, logging, and rate limiting
- `src/config/` - CORS and database configuration
- `src/utils/` - JWT helpers
- `prisma/schema.prisma` - database schema
- `prisma/migrations/` - migration history
- `prisma/seed.ts` - seed script
- `postman-collection.json` - Postman collection for API testing

## Database Setup

The project uses PostgreSQL with Prisma migrations.

Important entities:

- `User` - stores identity and role information
- `Contest` - stores contest metadata, access level, and timing window
- `Question` - stores contest questions and scoring points
- `Option` - stores answer options and correct/incorrect markers
- `Participation` - tracks whether a user joined and submitted a contest
- `Answer` - stores submitted answer selections
- `LeaderboardEntry` - stores score and rank per contest
- `PrizeAwarded` - stores the current winner's prize record

The schema and migration scripts are already included in `prisma/`.

## Database Structure

The database is organized around contest participation and scoring.

### Core Tables

- `User` stores authentication identity, role, and profile metadata.
- `Contest` stores the contest lifecycle, access level, timing window, and prize information.
- `Question` stores the contest questions, question type, order, and points.
- `Option` stores the selectable answers for each question and which ones are correct.
- `Participation` stores a user's join and submit state for a contest.
- `Answer` stores the selected options submitted for each participation.
- `LeaderboardEntry` stores the final score and rank for each contest participant.
- `PrizeAwarded` stores the winner record for each contest.

### Relationships

- One `User` can have many `Participation`, `LeaderboardEntry`, and `PrizeAwarded` rows.
- One `Contest` can have many `Question`, `Participation`, `LeaderboardEntry`, and `PrizeAwarded` rows.
- One `Question` belongs to one `Contest` and can have many `Option` rows.
- One `Participation` belongs to one `User` and one `Contest`, and can have many `Answer` rows.
- One `Answer` belongs to one `Participation`, one `Question`, and one `Option`.
- One `LeaderboardEntry` belongs to one `Contest` and one `User`.
- One `PrizeAwarded` belongs to one `Contest` and one `User`.

### Key Constraints

- `User.email` and `User.username` are unique.
- `Question` uses a unique `(contestId, order)` pair so question order stays deterministic inside a contest.
- `Option` uses a unique `(questionId, order)` pair so options stay deterministic per question.
- `Participation` uses a unique `(userId, contestId)` pair so a user can join a contest only once.
- `LeaderboardEntry` uses a unique `(contestId, userId)` pair and a unique `(contestId, rank)` pair.
- `PrizeAwarded` uses a unique `(contestId, userId)` pair so the same user is not duplicated for the same contest prize record.

### Data Flow Through the Tables

1. A user joins a contest, creating a `Participation` row.
2. The user submits answers, creating `Answer` rows tied to that participation.
3. The submission score is stored on `Participation` and mirrored in `LeaderboardEntry`.
4. The leaderboard is recalculated and ranks are updated.
5. The top-ranked user receives a `PrizeAwarded` record for that contest.

## API Authentication

All protected endpoints use JWT cookies.

### Cookies

- `accessToken` - short-lived access token
- `refreshToken` - longer-lived refresh token

### Authenticated Requests

Because the app uses HTTP-only cookies, most client requests should include credentials.

Examples:

- browser fetch with credentials
- Postman cookie jar
- frontend client configured with `credentials: include`

## API Reference

Base path: `/`

### Auth

- `POST /auth/register` - register a normal user
- `POST /auth/login` - log in with email and password
- `POST /auth/guest` - create an authenticated guest session
- `POST /auth/refresh` - refresh the access token
- `POST /auth/logout` - clear auth cookies
- `GET /auth/me` - return the current authenticated user

### Contests

- `GET /contest` - list accessible contests
- `GET /contest/:id` - fetch contest details
- `GET /contest/:id/questions` - fetch contest questions

### Participation

- `POST /participation/:id/join` - join a contest
- `POST /participation/:id/submit` - submit answers and receive a score
- `GET /participation/:id/leaderboard` - fetch leaderboard entries for a contest

### User

- `GET /user/me/history` - fetch full participation history
- `GET /user/me/history/inprogress` - fetch active participations
- `GET /user/me/prizes` - fetch prizes won by the current user
- `GET /user` - admin only, list users
- `PATCH /user/:id/role` - admin only, update a user role

### Questions

- `POST /contest/:id/questions` - admin only, create a question
- `PUT /contest/:id/questions/:questionId` - admin only, update a question
- `DELETE /contest/:id/questions/:questionId` - admin only, delete a question

## Request and Response Flow Examples

### Guest flow

1. `POST /auth/guest`
2. `GET /contest`
3. `GET /contest/:id/questions`
4. `POST /participation/:id/join`
5. `POST /participation/:id/submit`
6. `GET /participation/:id/leaderboard`
7. `GET /user/me/history`
8. `GET /user/me/prizes`

### Normal user flow

1. `POST /auth/register`
2. `POST /auth/login`
3. `GET /contest`
4. `GET /contest/:id`
5. `GET /contest/:id/questions`
6. `POST /participation/:id/join`
7. `POST /participation/:id/submit`
8. `GET /user/me/history`

### VIP flow

1. `POST /auth/login`
2. `GET /contest` to see VIP contests
3. `GET /contest/:id/questions` for VIP contest questions
4. `POST /participation/:id/join`
5. `POST /participation/:id/submit`
6. `GET /participation/:id/leaderboard`

### Admin flow

1. `POST /auth/login`
2. create or update contest
3. add or edit questions
4. manage user roles
5. monitor leaderboard and prize state

## Scoring Rules

- Questions can be single select, multi select, or true/false.
- Correct answers must match the expected option set exactly.
- Each question awards its configured `points` value.
- A contest score is the sum of all correct question scores.
- Re-submission is blocked once a participation is marked as submitted.

## Leaderboard Rules

- Leaderboard entries are stored per contest and per user.
- Ranks are recalculated after a submission.
- Sorting is by score descending.
- The leaderboard endpoint supports pagination via query params:
  - `limit`
  - `offset`

## Error Handling

The API returns structured JSON errors in the form:

```json
{
  "success": false,
  "message": "Human readable message"
}
```

Common cases handled by the API include:

- unauthorized access
- forbidden role access
- contest not found
- contest not active
- contest has not started yet
- contest has ended
- already joined contest
- already submitted contest
- invalid or malformed answers
- rate limit exceeded

## Rate Limiting

A global in-memory rate limiter is enabled in the server pipeline.

Current settings:

- 100 requests per 15 minutes per IP address

This helps protect the API from abuse while keeping normal usage smooth.

## Postman Collection

A ready-to-use Postman collection is included at:

- `postman-collection.json`

It includes examples for:

- auth flows
- contest browsing
- question retrieval
- participation join and submit
- leaderboard access
- user history and prizes

Import the collection into Postman and set `baseUrl` if needed. The collection is already configured for `http://localhost:5000`.

## Running the API Locally

If you want to verify the backend manually:

1. start PostgreSQL
2. set the `.env` values
3. run migrations
4. seed the database
5. start the server
6. use Postman or the collection file to exercise the endpoints

## Notes on Implementation

- Authentication is cookie-based and server-side verified.
- Authorization is enforced both in route middleware and controller logic for sensitive contest access.
- Guest users are represented as authenticated users with the `GUEST` role.
- The contest submission path validates answers thoroughly before persisting results.
- The leaderboard is recalculated after each submission to keep ranks current.

## Deliverables Included

- Source code in this repository
- PostgreSQL schema and migration scripts in `prisma/`
- Postman collection in `postman-collection.json`
- This setup and API documentation in `README.md`

## Troubleshooting

### JWT secret error

If the server fails during startup with a JWT secret error, verify that both `JWT_SECRET` and `JWT_REFRESH_SECRET` are set in `.env`.

### Database connection error

If Prisma cannot connect to PostgreSQL, confirm the `DATABASE_URL` value and that the database server is running.

### CORS error

If requests are blocked by CORS, add your frontend origin to `ALLOWED_ORIGINS`.

### Empty or missing data

If contests or questions do not appear, run the seed script or inspect the current migration state.

## License

UNLICENSED
