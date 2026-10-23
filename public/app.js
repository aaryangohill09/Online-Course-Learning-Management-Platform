
const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('appScreen');
const authForm = document.getElementById('authForm');

let authMode = 'login';
let currentUser = null;
let allCourses = [];
let currentCourse = null;
let currentLesson = null;
let currentPage = 'dashboard';
let toastTimer;

const $ = id => document.getElementById(id);

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        credentials: 'same-origin'
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'Something went wrong.');
    }

    return data;
}

function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

function escapeHTML(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function initials(name = 'Student') {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('');
}

function setAuthMode(mode) {
    authMode = mode;

    document.querySelectorAll('[data-auth-mode]').forEach(button => {
        button.classList.toggle(
            'active',
            button.dataset.authMode === mode
        );
    });

    $('nameLabel').classList.toggle('hidden', mode !== 'register');
    $('name').required = mode === 'register';

    $('authTitle').textContent = mode === 'login'
        ? 'Sign in to your account'
        : 'Create your account';

    $('authSubtitle').textContent = mode === 'login'
        ? 'Continue your learning journey.'
        : 'Create an account to start learning.';

    $('authSubmit').textContent = mode === 'login'
        ? 'Sign in'
        : 'Create account';

    $('password').autocomplete = mode === 'login'
        ? 'current-password'
        : 'new-password';

    $('authError').textContent = '';
}

document.querySelectorAll('[data-auth-mode]').forEach(button => {
    button.addEventListener('click', () => {
        setAuthMode(button.dataset.authMode);
    });
});

authForm.addEventListener('submit', async event => {
    event.preventDefault();

    const button = $('authSubmit');
    const errorBox = $('authError');

    errorBox.textContent = '';
    button.disabled = true;
    button.textContent = 'Please wait...';

    const payload = {
        email: $('email').value.trim(),
        password: $('password').value
    };

    if (authMode === 'register') {
        payload.name = $('name').value.trim();
    }

    try {
        const result = await api(
            authMode === 'login'
                ? '/api/login'
                : '/api/register',
            {
                method: 'POST',
                body: JSON.stringify(payload)
            }
        );

        currentUser = result.user;

        authForm.reset();

        await showApplication();
        showToast(
            authMode === 'login'
                ? 'Welcome back!'
                : 'Your account has been created.'
        );
    } catch (error) {
        errorBox.textContent = error.message;
    } finally {
        button.disabled = false;
        button.textContent = authMode === 'login'
            ? 'Sign in'
            : 'Create account';
    }
});

async function showApplication() {
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');

    $('profileName').textContent = currentUser.name;
    $('profileEmail').textContent = currentUser.email;
    $('profileInitials').textContent = initials(currentUser.name);
    $('topInitials').textContent = initials(currentUser.name);
    $('welcomeName').textContent = currentUser.name.split(' ')[0];
    $('todayDate').textContent = new Date().toLocaleDateString(
        'en-IN',
        {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }
    );

    await loadCourses();
    await showDashboard();
}

function showAuth() {
    currentUser = null;
    allCourses = [];
    currentCourse = null;
    currentLesson = null;

    appScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');

    setAuthMode('login');
}

async function loadCourses() {
    const result = await api('/api/courses');
    allCourses = result.courses;
}

function courseCover(course) {
    const icons = {
        web: '🌐',
        data: '📊',
        design: '🎨',
        business: '💼'
    };

    const type = ['web', 'data', 'design', 'business'].includes(course.color)
        ? course.color
        : 'web';

    return `
        <div class="course-cover cover-${type}">
            <span class="cover-orb"></span>
            <span class="cover-orb two"></span>
            <span class="cover-symbol">${icons[type]}</span>
        </div>
    `;
}

function progressBar(course) {
    const progress = Number(course.progress) || 0;

    return `
        <div class="progress-meta">
            <span>${course.completed_lessons || 0} of
                ${course.total_lessons || 0} lessons completed</span>
            <strong>${progress}%</strong>
        </div>
        <div class="progress-track">
            <div class="progress-fill" style="width:${progress}%"></div>
        </div>
    `;
}

function courseCard(course, catalog = false) {
    const buttonText = catalog
        ? (course.enrolled ? 'Open course' : 'Enroll now')
        : 'Continue';

    return `
        <article class="course-card">
            ${courseCover(course)}

            <div class="course-info">
                <p class="course-category">${escapeHTML(course.category)}</p>
                <h3>${escapeHTML(course.title)}</h3>
                <p>${escapeHTML(course.description)}</p>
            </div>

            ${catalog ? '' : progressBar(course)}

            <div class="card-bottom">
                <span class="small-meta">
                    ${escapeHTML(course.level)} · ${escapeHTML(course.duration)}
                </span>

                <button class="${catalog && !course.enrolled ? 'primary-btn' : 'secondary-btn'}"
                    data-course-action="${catalog && !course.enrolled ? 'enroll' : 'open'}"
                    data-course-id="${course.id}">
                    ${buttonText}
                </button>
            </div>
        </article>
    `;
}

function emptyState(title, message) {
    return `
        <div class="empty-state">
            <strong>${escapeHTML(title)}</strong>
            <span>${escapeHTML(message)}</span>
        </div>
    `;
}

async function showDashboard() {
    currentPage = 'dashboard';

    try {
        const data = await api('/api/dashboard');

        allCourses = await api('/api/courses')
            .then(result => result.courses);

        const enrolledCourses = data.courses;

        $('statCourses').textContent = data.stats.enrolled_courses;
        $('statLessons').textContent = data.stats.lessons_completed;
        $('statProgress').textContent =
            `${data.stats.average_progress || 0}%`;

        $('courseGrid').innerHTML = enrolledCourses.length
            ? enrolledCourses.slice(0, 3)
                .map(course => courseCard(course)).join('')
            : emptyState(
                'No courses yet',
                'Explore the course catalogue and enroll in your first course.'
            );

        if (data.next_lesson) {
            const course = enrolledCourses.find(
                item => item.id === data.next_lesson.course_id
            );

            $('continueCard').innerHTML = `
                ${course
                    ? courseCover(course)
                    : '<div class="course-cover cover-web">📘</div>'}
                <div class="course-info">
                    <p class="course-category">CONTINUE LEARNING</p>
                    <h3>${escapeHTML(data.next_lesson.course_title)}</h3>
                    <p>Next lesson: ${escapeHTML(data.next_lesson.title)}</p>
                    ${course ? progressBar(course) : ''}
                </div>
                <button class="primary-btn"
                    data-open-lesson="${data.next_lesson.id}"
                    data-course-id="${data.next_lesson.course_id}">
                    Continue →
                </button>
            `;
        } else {
            $('continueCard').innerHTML = emptyState(
                enrolledCourses.length
                    ? 'All lessons completed!'
                    : 'Start your learning journey',
                enrolledCourses.length
                    ? 'Great work. Explore another course to keep learning.'
                    : 'Explore courses and choose one that interests you.'
            );
        }

        showPage('dashboard');
    } catch (error) {
        showToast(error.message);
    }
}

function showPage(page) {
    currentPage = page;

    document.querySelectorAll('.page').forEach(section => {
        section.classList.add('hidden');
    });

    const section = $(`${page}Page`);

    if (section) {
        section.classList.remove('hidden');
    }

    document.querySelectorAll('.nav-link').forEach(button => {
        button.classList.toggle(
            'active',
            button.dataset.page === page
        );
    });

    $('crumb').textContent = {
        dashboard: 'Dashboard',
        courses: 'My courses',
        catalog: 'Explore courses',
        lesson: 'Lesson'
    }[page] || 'Dashboard';
}

async function showMyCourses() {
    try {
        await loadCourses();

        const courses = allCourses.filter(course => course.enrolled);

        renderMyCourses(courses);
        showPage('courses');
    } catch (error) {
        showToast(error.message);
    }
}

function renderMyCourses(courses) {
    const search = $('courseSearch').value.trim().toLowerCase();
    const filter = $('courseFilter').value;

    const filtered = courses.filter(course => {
        const matchesSearch = course.title.toLowerCase().includes(search)
            || course.category.toLowerCase().includes(search);

        const matchesFilter = filter === 'all'
            || (filter === 'progress' && course.progress > 0 && course.progress < 100)
            || (filter === 'complete' && course.progress === 100);

        return matchesSearch && matchesFilter;
    });

    $('allCoursesGrid').innerHTML = filtered.length
        ? filtered.map(course => courseCard(course)).join('')
        : emptyState(
            'No matching courses',
            'Try another search or explore the available courses.'
        );
}

async function showCatalog() {
    try {
        await loadCourses();

        renderCatalog();
        showPage('catalog');
    } catch (error) {
        showToast(error.message);
    }
}

function renderCatalog() {
    const search = $('catalogSearch').value.trim().toLowerCase();

    const filtered = allCourses.filter(course =>
        course.title.toLowerCase().includes(search)
        || course.category.toLowerCase().includes(search)
        || course.description.toLowerCase().includes(search)
    );

    $('catalogGrid').innerHTML = filtered.length
        ? filtered.map(course => courseCard(course, true)).join('')
        : emptyState(
            'No courses found',
            'Try searching with another keyword.'
        );
}

async function enrollCourse(courseId) {
    try {
        await api(`/api/courses/${courseId}/enroll`, {
            method: 'POST',
            body: JSON.stringify({})
        });

        await loadCourses();
        renderCatalog();
        showToast('Course added to your learning list.');
    } catch (error) {
        showToast(error.message);
    }
}

async function openCourse(courseId) {
    try {
        const data = await api(`/api/courses/${courseId}`);

        currentCourse = data.course;

        renderLessonPage(data, null);
        showPage('lesson');
    } catch (error) {
        showToast(error.message);
    }
}

function renderLessonPage(data, selectedLessonId) {
    const course = data.course;
    const modules = data.modules;

    let lessonsHTML = '';

    modules.forEach(module => {
        lessonsHTML += `
            <p class="module-title">${escapeHTML(module.title)}</p>
        `;

        module.lessons.forEach(lesson => {
            const isCurrent = selectedLessonId === lesson.id;
            const isDone = Boolean(lesson.completed);

            lessonsHTML += `
                <div class="lesson-item ${isCurrent ? 'current' : ''}"
                    data-select-lesson="${lesson.id}">
                    <span class="lesson-check ${isDone ? 'done' : ''}">
                        ${isDone ? '✓' : ''}
                    </span>
                    <div>
                        <strong>${escapeHTML(lesson.title)}</strong>
                        <small>${escapeHTML(lesson.duration)}</small>
                    </div>
                </div>
            `;
        });
    });

    const allLessons = modules.flatMap(module => module.lessons);

    currentLesson = allLessons.find(
        lesson => lesson.id === selectedLessonId
    ) || allLessons.find(lesson => !lesson.completed)
      || allLessons[0]
      || null;

    $('lessonContent').innerHTML = `
        <div class="page-title">
            <p class="eyebrow">${escapeHTML(course.category)}</p>
            <h1>${escapeHTML(course.title)}</h1>
            <p class="muted">${escapeHTML(course.description)}</p>
            ${progressBar(course)}
        </div>

        <div class="lesson-layout">
            <article class="lesson-main">
                ${currentLesson ? `
                    <p class="course-category">
                        ${escapeHTML(currentLesson.module_title || 'COURSE LESSON')}
                    </p>

                    <h1>${escapeHTML(currentLesson.title)}</h1>

                    <div class="lesson-player">
                        <div class="play-circle">▶</div>
                        <strong>Learning lesson</strong>
                        <small>${escapeHTML(currentLesson.duration)}</small>
                    </div>

                    <h2>Lesson overview</h2>
                    <p>${escapeHTML(currentLesson.content)}</p>

                    <div class="lesson-actions">
                        <button class="secondary-btn" id="refreshCourse">
                            Refresh progress
                        </button>

                        <button class="primary-btn" id="completeLesson">
                            ${currentLesson.completed
                                ? 'Mark as incomplete'
                                : 'Mark as complete ✓'}
                        </button>
                    </div>
                ` : `
                    <h2>No lessons available</h2>
                    <p>This course does not have any lessons yet.</p>
                `}
            </article>

            <aside class="lesson-sidebar">
                <h3>Course content</h3>
                <p>${course.completed_lessons} of ${course.total_lessons} lessons completed</p>
                ${lessonsHTML}
            </aside>
        </div>
    `;
}

async function selectLesson(lessonId) {
    if (!currentCourse) {
        return;
    }

    try {
        const data = await api(`/api/courses/${currentCourse.id}`);
        renderLessonPage(data, Number(lessonId));
    } catch (error) {
        showToast(error.message);
    }
}

async function toggleLesson() {
    if (!currentLesson) {
        return;
    }

    const endpoint = currentLesson.completed
        ? `/api/lessons/${currentLesson.id}/incomplete`
        : `/api/lessons/${currentLesson.id}/complete`;

    try {
        await api(endpoint, {
            method: 'POST',
            body: JSON.stringify({})
        });

        const selectedId = currentLesson.id;
        const data = await api(`/api/courses/${currentCourse.id}`);

        await loadCourses();

        renderLessonPage(data, selectedId);

        showToast(
            currentLesson.completed
                ? 'Lesson completed!'
                : 'Lesson marked incomplete.'
        );
    } catch (error) {
        showToast(error.message);
    }
}

document.addEventListener('click', async event => {
    const pageButton = event.target.closest('[data-page]');

    if (pageButton) {
        const page = pageButton.dataset.page;

        if (page === 'dashboard') {
            await showDashboard();
        } else if (page === 'courses') {
            await showMyCourses();
        } else if (page === 'catalog') {
            await showCatalog();
        }

        return;
    }

    const gotoButton = event.target.closest('[data-goto]');

    if (gotoButton) {
        if (gotoButton.dataset.goto === 'courses') {
            await showMyCourses();
        }
        return;
    }

    const courseButton = event.target.closest('[data-course-action]');

    if (courseButton) {
        const courseId = Number(courseButton.dataset.courseId);

        if (courseButton.dataset.courseAction === 'enroll') {
            await enrollCourse(courseId);
        } else {
            await openCourse(courseId);
        }

        return;
    }

    const lessonButton = event.target.closest('[data-open-lesson]');

    if (lessonButton) {
        await openCourse(Number(lessonButton.dataset.courseId));

        if (lessonButton.dataset.openLesson) {
            await selectLesson(Number(lessonButton.dataset.openLesson));
        }

        return;
    }

    const selectedLesson = event.target.closest('[data-select-lesson]');

    if (selectedLesson) {
        await selectLesson(Number(selectedLesson.dataset.selectLesson));
        return;
    }

    if (event.target.closest('#completeLesson')) {
        await toggleLesson();
        return;
    }

    if (event.target.closest('#refreshCourse')) {
        if (currentCourse) {
            await openCourse(currentCourse.id);
        }
        return;
    }

    if (event.target.closest('#backToCourse')) {
        await showMyCourses();
        return;
    }

    if (event.target.closest('#logoutBtn')) {
        try {
            await api('/api/logout', {
                method: 'POST',
                body: JSON.stringify({})
            });

            showAuth();
            showToast('You have signed out.');
        } catch (error) {
            showToast(error.message);
        }
        return;
    }

    if (event.target.closest('#helpBtn')) {
        showToast('Set a small daily learning goal and complete lessons regularly.');
    }
});

$('courseSearch').addEventListener('input', () => {
    renderMyCourses(allCourses.filter(course => course.enrolled));
});

$('courseFilter').addEventListener('change', () => {
    renderMyCourses(allCourses.filter(course => course.enrolled));
});

$('catalogSearch').addEventListener('input', renderCatalog);

async function startApp() {
    try {
        const data = await api('/api/me');

        if (data.user) {
            currentUser = data.user;
            await showApplication();
        } else {
            showAuth();
        }
    } catch (error) {
        showAuth();
        $('authError').textContent =
            'Cannot connect to the server. Please start the project server.';
    }
}

startApp();
