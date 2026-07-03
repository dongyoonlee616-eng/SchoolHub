const pool = require("./db");
const bcrypt = require("bcrypt");

async function setup() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    `);

    await pool.query(`
      INSERT INTO schools (name, slug)
      SELECT '근명중학교', 'geunmyeong-middle'
      WHERE NOT EXISTS (
        SELECT 1 FROM schools WHERE slug = 'geunmyeong-middle'
      );
    `);

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminPassword) {
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
    } else {
      console.log("ADMIN_PASSWORD가 없어서 관리자 계정 생성은 건너뜀");
    }

    console.log("✅ DB 테이블 생성 완료");
  } catch (error) {
    console.error("❌ DB 생성 오류:", error);
  } finally {
    await pool.end();
  }
}

setup();