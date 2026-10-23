# Online Course & Learning Management Platform

A student-friendly full-stack project using HTML, CSS, JavaScript, Node.js/Express and SQLite.

## Features
- Student registration and login
- Passwords stored as bcrypt hashes
- Session-based authentication
- Personal dashboard and course statistics
- Browse and enroll in courses
- Course modules and lesson content
- Mark lessons complete or incomplete
- Progress percentages calculated from database records
- User-specific progress that persists after signing out and back in
- Search and filter courses
- Responsive layout

## Requirements
- Node.js 18 or newer
- Internet for the first `npm install` to download dependencies

## Run on Windows
1. Extract `learnspace_fullstack.zip`.
2. Open the extracted `learnspace_fullstack` folder.
3. Click the File Explorer address bar, type `cmd`, and press Enter.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000` in Chrome.
7. Click **Create account**, then register using your name, email and a password of at least 8 characters.

## Database
The `learnspace.db` SQLite database is created automatically when the server starts. Sample courses, modules and lessons are inserted on the first run. User accounts, enrollments and progress are stored in this database.

## Main API routes
- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `GET /api/dashboard`
- `GET /api/courses`
- `POST /api/courses/:id/enroll`
- `GET /api/courses/:id`
- `POST /api/lessons/:id/complete`
- `POST /api/lessons/:id/incomplete`
- `GET /api/health`

## Important notes
This is a local academic demo, not production-ready hosting. Before public deployment, set a strong `SESSION_SECRET`, enable HTTPS and secure cookies, configure a persistent production session store, add rate limiting and CSRF protection, and review security settings. Do not use a personal password for a classroom demo. Lesson media is represented by a placeholder; lesson text is stored in SQLite.

## Troubleshooting
- If `npm` is not recognised, install Node.js LTS from `https://nodejs.org` and reopen Command Prompt.
- If port 3000 is busy, use Command Prompt: `set PORT=3001 && npm start`, then open `http://localhost:3001`.
- To reset demo data, stop the server and delete `learnspace.db`. This also deletes demo accounts and progress.
