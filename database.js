const Database = require('better-sqlite3');
const path = require('path');

function openDatabase() {
  const db = new Database(path.join(__dirname, 'learnspace.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, category TEXT NOT NULL, level TEXT NOT NULL,
      duration TEXT NOT NULL, description TEXT NOT NULL, color TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL, sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      title TEXT NOT NULL, duration TEXT NOT NULL, content TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lesson_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      completed INTEGER NOT NULL DEFAULT 0, completed_at TEXT,
      PRIMARY KEY (user_id, lesson_id)
    );
  `);
  return db;
}

function seedDatabase(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM courses').get().n) return;
  const data = [
    { title:'Web Development Basics', category:'Development', level:'Beginner', duration:'4h 20m', description:'Learn how websites are built with HTML, CSS and JavaScript.', color:'web', modules:[
      { title:'Getting started', lessons:[['Welcome to web development','6 min','Web development is the work of building websites and web applications. In this course, you will learn the basic tools and concepts.'],['Setting up your workspace','9 min','A code editor and a browser are enough to start. Keep your files organised and give each project a clear folder.']]},
      { title:'HTML and CSS', lessons:[['Your first HTML page','12 min','HTML gives a page its structure. Use headings, paragraphs, links and images to organise content clearly.'],['Styling with CSS','15 min','CSS controls the look of a page. Start with spacing, readable type, colours and a layout that works on small screens.']]},
      { title:'JavaScript basics', lessons:[['Add simple interactions','14 min','JavaScript makes a page interactive. Respond to clicks, update text and store information.']]}
    ]},
    { title:'Introduction to Data Analytics', category:'Data', level:'Beginner', duration:'3h 10m', description:'Understand data, find patterns and make better decisions.', color:'data', modules:[
      { title:'Data foundations', lessons:[['What is data analytics?','8 min','Data analytics examines information to answer questions, spot patterns and support decisions.'],['Types of data','11 min','Data can be numeric, categorical, structured or unstructured. The type helps you choose a suitable method.']]},
      { title:'Working with data', lessons:[['Cleaning a dataset','13 min','Check missing values, duplicates, inconsistent formats and unusual values before analysis.'],['Reading charts','10 min','Bar charts compare categories; line charts help show change over time.']]}
    ]},
    { title:'UI/UX Design Essentials', category:'Design', level:'Beginner', duration:'2h 45m', description:'Learn the basics of user-friendly digital product design.', color:'design', modules:[
      { title:'Design thinking', lessons:[['What makes a good experience?','7 min','Good design helps people complete tasks without confusion. Clear labels and useful feedback matter.'],['Understand your users','10 min','Learn what users need, what gets in their way and what success looks like.']]},
      { title:'Interface basics', lessons:[['Layout and visual hierarchy','12 min','Use size, spacing, contrast and alignment to make important information easy to find.'],['Make designs accessible','9 min','Readable text, sufficient contrast, keyboard access and descriptive labels help more people use a product.']]}
    ]},
    { title:'Business Communication', category:'Business', level:'Beginner', duration:'2h 30m', description:'Build confidence in emails, presentations and teamwork.', color:'business', modules:[
      { title:'Clear communication', lessons:[['Writing a professional email','8 min','A useful email has a clear subject, polite opening, main point and specific next step.'],['Presenting your ideas','12 min','Keep presentations focused on key points, use examples and finish by making the action clear.']]}
    ]}
  ];
  const addCourse = db.prepare('INSERT INTO courses (title,category,level,duration,description,color) VALUES (@title,@category,@level,@duration,@description,@color)');
  const addModule = db.prepare('INSERT INTO modules (course_id,title,sort_order) VALUES (?,?,?)');
  const addLesson = db.prepare('INSERT INTO lessons (course_id,module_id,title,duration,content,sort_order) VALUES (?,?,?,?,?,?)');
  db.transaction(() => {
    for (const c of data) {
      const cid = Number(addCourse.run(c).lastInsertRowid);
      c.modules.forEach((m, mi) => {
        const mid = Number(addModule.run(cid,m.title,mi+1).lastInsertRowid);
        m.lessons.forEach((l, li) => addLesson.run(cid,mid,l[0],l[1],l[2],li+1));
      });
    }
  })();
}
module.exports = { openDatabase, seedDatabase };
