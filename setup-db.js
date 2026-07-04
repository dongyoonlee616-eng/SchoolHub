const pool = require("./db");
const bcrypt = require("bcrypt");

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

    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) UNIQUE NOT NULL,
      run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function seedDefaultSchool() {
  const result = await pool.query("SELECT COUNT(*) FROM schools");
  const schoolCount = Number(result.rows[0].count);

  if (schoolCount > 0) {
    console.log("기존 학교 데이터가 있어서 기본 학교 생성은 건너뜀");
    return;
  }

  await pool.query(
    `
    INSERT INTO schools (name, slug, is_active)
    VALUES ($1, $2, true)
    `,
    ["근명중학교", "geunmyeong-middle"]
  );

  console.log("기본 학교 데이터 생성 완료");
}

async function seedAdmin() {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.log("ADMIN_PASSWORD가 없어서 관리자 계정 생성은 건너뜀");
    return;
  }

  const hash = await bcrypt.hash(adminPassword, 10);

  await pool.query(
    `
    INSERT INTO admins (username, password_hash, role)
    VALUES ($1, $2, 'admin')
    ON CONFLICT (username) DO NOTHING
    `,
    ["admin", hash]
  );

  console.log("관리자 계정 확인 완료: admin");
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

    await seedDefaultSchool();
    console.log("기본 학교 데이터 확인 완료");

    await seedAdmin();

    console.log("✅ DB 세팅 완료");
  } catch (error) {
    console.error("❌ DB 세팅 오류:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setup();