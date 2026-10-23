
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');

const { openDatabase, seedDatabase } = require('./database');

const app = express();
const db = openDatabase();

seedDatabase(db);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            'learnspace-local-demo-change-before-deploy',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 8 * 60 * 60 * 1000
        }
    })
);

// Serve frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
function loginRequired(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            error: 'Please sign in to continue.'
        });
    }

    next();
}

// Get safe user details
function userById(id) {
    return db.prepare(
        'SELECT id, name, email FROM users WHERE id = ?'
    ).get(id);
}

// Get all courses with enrollment and progress information
function listCourses(userId) {
    return db.prepare(`
        SELECT
            c.*,
            e.enrolled_at,

            (
                SELECT COUNT(*)
                FROM lessons l
                WHERE l.course_id = c.id
            ) AS total_lessons,

            (
                SELECT COUNT(*)
                FROM lesson_progress lp
                JOIN lessons l2 ON l2.id = lp.lesson_id
                WHERE lp.user_id = ?
                  AND l2.course_id = c.id
                  AND lp.completed = 1
            ) AS completed_lessons,

            EXISTS(
                SELECT 1
                FROM enrollments e2
                WHERE e2.user_id = ?
                  AND e2.course_id = c.id
            ) AS enrolled

        FROM courses c

        LEFT JOIN enrollments e
            ON e.course_id = c.id
            AND e.user_id = ?

        ORDER BY c.id
    `).all(userId, userId, userId).map(course => ({
        ...course,
        enrolled: Boolean(course.enrolled),
        progress: course.total_lessons
            ? Math.round(
                (course.completed_lessons /
                    course.total_lessons) * 100
            )
            : 0
    }));
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        database: 'sqlite'
    });
});

// Get currently signed-in user
app.get('/api/me', (req, res) => {
    res.json({
        user: req.session.userId
            ? userById(req.session.userId)
            : null
    });
});

// Register
app.post('/api/register', async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '')
        .trim()
        .toLowerCase();
    const password = String(req.body.password || '');

    if (name.length < 2) {
        return res.status(400).json({
            error: 'Please enter your name (at least 2 characters).'
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            error: 'Enter a valid email address.'
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            error: 'Password must contain at least 8 characters.'
        });
    }

    try {
        const hash = await bcrypt.hash(password, 10);

        const result = db.prepare(`
            INSERT INTO users (name, email, password_hash)
            VALUES (?, ?, ?)
        `).run(name, email, hash);

        req.session.userId = Number(result.lastInsertRowid);

        res.status(201).json({
            user: userById(req.session.userId)
        });
    } catch (error) {
        if (String(error.message).includes('UNIQUE')) {
            return res.status(409).json({
                error:
                    'An account with this email already exists. Please sign in.'
            });
        }

        console.error('Registration error:', error);

        res.status(500).json({
            error: 'Could not create account. Please try again.'
        });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const email = String(req.body.email || '')
        .trim()
        .toLowerCase();
    const password = String(req.body.password || '');

    try {
        const user = db.prepare(
            'SELECT * FROM users WHERE email = ?'
        ).get(email);

        if (
            !user ||
            !(await bcrypt.compare(password, user.password_hash))
        ) {
            return res.status(401).json({
                error: 'Email or password is incorrect.'
            });
        }

        req.session.userId = user.id;

        res.json({
            user: userById(user.id)
        });
    } catch (error) {
        console.error('Login error:', error);

        res.status(500).json({
            error: 'Could not sign in. Please try again.'
        });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    if (!req.session) {
        return res.json({ message: 'Logged out.' });
    }

    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({
                error: 'Could not log out. Please try again.'
            });
        }

        res.clearCookie('connect.sid');

        res.json({
            message: 'Logged out.'
        });
    });
});

// Get courses
app.get('/api/courses', loginRequired, (req, res) => {
    res.json({
        courses: listCourses(req.session.userId)
    });
});

// Enroll in a course
app.post('/api/courses/:id/enroll', loginRequired, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
            error: 'Invalid course ID.'
        });
    }

    const course = db.prepare(
        'SELECT id FROM courses WHERE id = ?'
    ).get(id);

    if (!course) {
        return res.status(404).json({
            error: 'Course not found.'
        });
    }

    db.prepare(`
        INSERT OR IGNORE INTO enrollments (user_id, course_id)
        VALUES (?, ?)
    `).run(req.session.userId, id);

    res.json({
        message: 'Course added to your learning list.'
    });
});

// Get course details and lessons
app.get('/api/courses/:id', loginRequired, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
            error: 'Invalid course ID.'
        });
    }

    const course = db.prepare(
        'SELECT * FROM courses WHERE id = ?'
    ).get(id);

    if (!course) {
        return res.status(404).json({
            error: 'Course not found.'
        });
    }

    const enrolled = db.prepare(`
        SELECT 1
        FROM enrollments
        WHERE user_id = ? AND course_id = ?
    `).get(req.session.userId, id);

    if (!enrolled) {
        return res.status(403).json({
            error: 'Enroll in this course to view its lessons.'
        });
    }

    const modules = db.prepare(`
        SELECT *
        FROM modules
        WHERE course_id = ?
        ORDER BY sort_order
    `).all(id);

    const lessons = db.prepare(`
        SELECT
            l.*,
            m.title AS module_title,
            COALESCE(lp.completed, 0) AS completed,
            lp.completed_at

        FROM lessons l

        JOIN modules m
            ON m.id = l.module_id

        LEFT JOIN lesson_progress lp
            ON lp.lesson_id = l.id
            AND lp.user_id = ?

        WHERE l.course_id = ?

        ORDER BY m.sort_order, l.sort_order
    `).all(req.session.userId, id);

    const completedLessons = lessons.filter(
        lesson => Boolean(lesson.completed)
    ).length;

    res.json({
        course: {
            ...course,
            total_lessons: lessons.length,
            completed_lessons: completedLessons,
            progress: lessons.length
                ? Math.round(
                    (completedLessons / lessons.length) * 100
                )
                : 0
        },

        modules: modules.map(module => ({
            ...module,
            lessons: lessons.filter(
                lesson => lesson.module_id === module.id
            )
        }))
    });
});

// Mark a lesson as complete
app.post('/api/lessons/:id/complete', loginRequired, (req, res) => {
    const lessonId = Number(req.params.id);

    if (!Number.isInteger(lessonId) || lessonId < 1) {
        return res.status(400).json({
            error: 'Invalid lesson ID.'
        });
    }

    const lesson = db.prepare(`
        SELECT id, course_id
        FROM lessons
        WHERE id = ?
    `).get(lessonId);

    if (!lesson) {
        return res.status(404).json({
            error: 'Lesson not found.'
        });
    }

    const enrolled = db.prepare(`
        SELECT 1
        FROM enrollments
        WHERE user_id = ? AND course_id = ?
    `).get(req.session.userId, lesson.course_id);

    if (!enrolled) {
        return res.status(403).json({
            error: 'Enroll in this course first.'
        });
    }

    db.prepare(`
        INSERT INTO lesson_progress
            (user_id, lesson_id, completed, completed_at)
        VALUES (?, ?, 1, CURRENT_TIMESTAMP)

        ON CONFLICT(user_id, lesson_id)
        DO UPDATE SET
            completed = 1,
            completed_at = CURRENT_TIMESTAMP
    `).run(req.session.userId, lesson.id);

    res.json({
        message: 'Lesson marked complete.'
    });
});

// Mark a lesson as incomplete
app.post('/api/lessons/:id/incomplete', loginRequired, (req, res) => {
    const lessonId = Number(req.params.id);

    if (!Number.isInteger(lessonId) || lessonId < 1) {
        return res.status(400).json({
            error: 'Invalid lesson ID.'
        });
    }

    const lesson = db.prepare(`
        SELECT id, course_id
        FROM lessons
        WHERE id = ?
    `).get(lessonId);

    if (!lesson) {
        return res.status(404).json({
            error: 'Lesson not found.'
        });
    }

    const enrolled = db.prepare(`
        SELECT 1
        FROM enrollments
        WHERE user_id = ? AND course_id = ?
    `).get(req.session.userId, lesson.course_id);

    if (!enrolled) {
        return res.status(403).json({
            error: 'Enroll in this course first.'
        });
    }

    db.prepare(`
        DELETE FROM lesson_progress
        WHERE user_id = ? AND lesson_id = ?
    `).run(req.session.userId, lesson.id);

    res.json({
        message: 'Lesson marked incomplete.'
    });
});

// Dashboard
app.get('/api/dashboard', loginRequired, (req, res) => {
    const courses = listCourses(req.session.userId);

    const enrolledCourses = courses.filter(
        course => course.enrolled
    );

    const lessonsCompleted = enrolledCourses.reduce(
        (total, course) => total + course.completed_lessons,
        0
    );

    const averageProgress = enrolledCourses.length
        ? Math.round(
            enrolledCourses.reduce(
                (total, course) => total + course.progress,
                0
            ) / enrolledCourses.length
        )
        : 0;

    const nextLesson = db.prepare(`
        SELECT
            l.id,
            l.title,
            l.course_id,
            c.title AS course_title

        FROM lessons l

        JOIN courses c
            ON c.id = l.course_id

        JOIN enrollments e
            ON e.course_id = c.id
            AND e.user_id = ?

        LEFT JOIN lesson_progress lp
            ON lp.lesson_id = l.id
            AND lp.user_id = ?
            AND lp.completed = 1

        WHERE lp.lesson_id IS NULL

        ORDER BY c.id, l.sort_order

        LIMIT 1
    `).get(req.session.userId, req.session.userId);

    res.json({
        courses: enrolledCourses,

        stats: {
            enrolled_courses: enrolledCourses.length,
            lessons_completed: lessonsCompleted,
            average_progress: averageProgress
        },

        next_lesson: nextLesson || null
    });
});

// Frontend fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        error: 'An unexpected server error occurred.'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`LearnSpace running at http://localhost:${PORT}`);
});
