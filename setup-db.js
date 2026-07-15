const pool = require("./db");

const migrations = [
  {
    name: "20260703_01_add_school_management_columns",
    sql: `
      ALTER TABLE schools
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

      ALTER TABLE schools
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
    `,
  },
  {
    name: "20260703_02_stabilize_lost_items_columns",
    sql: `
      ALTER TABLE lost_items
      ADD COLUMN IF NOT EXISTS found_place VARCHAR(200);

      ALTER TABLE lost_items
      ADD COLUMN IF NOT EXISTS pickup_place VARCHAR(200);

      ALTER TABLE lost_items
      ADD COLUMN IF NOT EXISTS item_date DATE;

      ALTER TABLE lost_items
      ADD COLUMN IF NOT EXISTS password_hash TEXT;

      ALTER TABLE lost_items
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

      ALTER TABLE lost_items
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

      UPDATE lost_items
      SET found_place = place
      WHERE found_place IS NULL
        AND place IS NOT NULL;
    `,
  },
  {
    name: "20260703_03_add_basic_indexes",
    sql: `
      CREATE INDEX IF NOT EXISTS idx_posts_school_status_created
      ON posts (school_id, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_comments_post_status_created
      ON comments (post_id, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_lost_items_school_status_created
      ON lost_items (school_id, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_notices_school_pinned_created
      ON notices (school_id, is_pinned DESC, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_schools_slug
      ON schools (slug);
    `,
  },
  {
    name: "20260704_01_create_post_reports",
    sql: `
      CREATE TABLE IF NOT EXISTS post_reports (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        reporter_nickname VARCHAR(50) NOT NULL,
        reason VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_post_reports_school_status_created
      ON post_reports (school_id, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_post_reports_post_id
      ON post_reports (post_id);
    `,
  },  
  {
    name: "20260704_02_create_comment_reports",
    sql: `
      CREATE TABLE IF NOT EXISTS comment_reports (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
        comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
        reporter_nickname VARCHAR(50) NOT NULL,
        reason VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_comment_reports_school_status_created
      ON comment_reports (school_id, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_comment_reports_comment_id
      ON comment_reports (comment_id);

      CREATE INDEX IF NOT EXISTS idx_comment_reports_post_id
      ON comment_reports (post_id);
    `,
  },
  {
    name: "20260704_04_create_support_tickets",
    sql: `
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        ticket_type VARCHAR(20) NOT NULL,
        nickname VARCHAR(50) NOT NULL,
        contact VARCHAR(100),
        title VARCHAR(150) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        admin_memo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_support_tickets_type_status_created
      ON support_tickets (ticket_type, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created
      ON support_tickets (status, created_at DESC);
    `,
  },
  {
    name: "20260704_06_stabilize_support_tickets_columns",
    sql: `
      ALTER TABLE support_tickets
      ADD COLUMN IF NOT EXISTS admin_memo TEXT;

      ALTER TABLE support_tickets
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE support_tickets
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

      UPDATE support_tickets
      SET status = 'pending'
      WHERE status NOT IN ('pending', 'resolved');
    `,
  },
  {
    name: "20260711_01_add_app_users",
    sql: `
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        nickname VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(120) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;

      ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;

      ALTER TABLE lost_items
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);
      CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts (user_id);
      CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);
      CREATE INDEX IF NOT EXISTS idx_lost_items_user_id ON lost_items (user_id);
    `,
  },
  {
    name: "20260711_03_make_lost_item_password_optional",
    sql: `
      ALTER TABLE lost_items
      ALTER COLUMN password_hash DROP NOT NULL;

      ALTER TABLE lost_items
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_lost_items_user_id ON lost_items (user_id);
    `,
  },
  {
    name: "20260711_05_remove_legacy_admin_tables",
    sql: `
      DROP TABLE IF EXISTS admins;
    `,
  },
  {
    name: "20260712_01_add_user_id_to_support_tickets",
    sql: `
      ALTER TABLE support_tickets
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id
      ON support_tickets (user_id);
    `,
  },
  {
    name: "20260712_02_add_email_verification",
    sql: `
      ALTER TABLE app_users
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

      ALTER TABLE app_users
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

      ALTER TABLE app_users
      ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;

      ALTER TABLE app_users
      ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP;
    `,
  },
  {
    name: "20260714_01_set_super_admin_email",
    sql: `
      UPDATE app_users
      SET role = 'admin'
      WHERE LOWER(email) = 'dong.yoon.lee616@gmail.com';
    `,
  },
  {
    name: "20260715_01_set_superadmin_role",
    sql: `
      UPDATE app_users
      SET role = 'superadmin'
      WHERE LOWER(email) = 'dong.yoon.lee616@gmail.com';
    `,
  },
];

async function createBaseTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schools (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      category VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      nickname VARCHAR(50) NOT NULL,
      password_hash TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      approved_at TIMESTAMP,
      updated_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      nickname VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      approved_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notices (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      is_pinned BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      nickname VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'unread',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lost_items (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      place VARCHAR(200),
      found_place VARCHAR(200),
      pickup_place VARCHAR(200),
      item_date DATE,
      nickname VARCHAR(50) NOT NULL,
      password_hash TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      found_status VARCHAR(20) DEFAULT 'lost',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      approved_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS post_reports (
      id SERIAL PRIMARY KEY,
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      reporter_nickname VARCHAR(50) NOT NULL,
      reason VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comment_reports (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
    reporter_nickname VARCHAR(50) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    ticket_type VARCHAR(20) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    contact VARCHAR(100),
    title VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    admin_memo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) UNIQUE NOT NULL,
    run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
}

async function seedDefaultSchools() {
  const defaultSchools = [
    ["근명중학교", "keunmyung-middle"],
    ["신안중학교", "sinan-middle"],
    ["안양부흥중학교", "anyangbuheung-middle"],
    ["박달중학교", "bakdal-middle"],
    ["성문중학교", "sungmoon-middle"],
    ["신성중학교", "shinsung-middle"],
    ["안양서중학교", "anyangseo-middle"],
    ["안양여자중학교", "anyang-girls-middle"],
    ["연현중학교", "yeonhyeon-middle"],
    ["관양중학교", "kwanyang-middle"],
    ["귀인중학교", "gwiin-middle"],
    ["대안여자중학교", "daean-girls-middle"],
    ["대안중학교", "daean-middle"],
    ["범계중학교", "bumgye-middle"],
    ["부림중학교", "burim-middle"],
    ["부안중학교", "buan-middle"],
    ["비산중학교", "bisan-middle"],
    ["인덕원중학교", "indeogwon-middle"],
    ["임곡중학교", "imgok-middle"],
    ["신기중학교", "singi-middle"],
    ["평촌중학교", "pyongchon-middle"],
    ["호계중학교", "hogye-middle"],
    ["호성중학교", "hoseong-middle"],
  ];

  await pool.query("BEGIN");

  try {
    for (const [name, slug] of defaultSchools) {
      // 같은 이름의 학교가 이미 있으면 slug와 활성 상태를 갱신
      const updateResult = await pool.query(
        `
          UPDATE schools
          SET slug = $2,
              is_active = true,
              updated_at = CURRENT_TIMESTAMP
          WHERE name = $1
        `,
        [name, slug]
      );

      // 같은 이름의 학교가 없으면 새로 추가
      if (updateResult.rowCount === 0) {
        await pool.query(
          `
            INSERT INTO schools (name, slug, is_active)
            VALUES ($1, $2, true)
            ON CONFLICT (slug)
            DO UPDATE SET
              name = EXCLUDED.name,
              is_active = true,
              updated_at = CURRENT_TIMESTAMP
          `,
          [name, slug]
        );
      }
    }

    await pool.query("COMMIT");
    console.log(`기본 학교 데이터 확인 완료: ${defaultSchools.length}개`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function runMigrations() {
  for (const migration of migrations) {
    const result = await pool.query(
      "SELECT id FROM schema_migrations WHERE name = $1",
      [migration.name]
    );

    if (result.rows.length > 0) {
      console.log(`건너뜀: ${migration.name}`);
      continue;
    }

    console.log(`실행 중: ${migration.name}`);

    try {
      await pool.query("BEGIN");
      await pool.query(migration.sql);
      await pool.query(
        "INSERT INTO schema_migrations (name) VALUES ($1)",
        [migration.name]
      );
      await pool.query("COMMIT");

      console.log(`완료: ${migration.name}`);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
}

async function setup() {
  try {
    await createBaseTables();
    console.log("기본 DB 테이블 확인 완료");

    await runMigrations();
    console.log("DB 마이그레이션 확인 완료");

    await seedDefaultSchools();
    console.log("기본 학교 데이터 확인 완료");

    console.log("✅ DB 세팅 완료");
  } catch (error) {
    console.error("❌ DB 세팅 오류:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setup();