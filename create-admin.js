const bcrypt = require("bcrypt");
const pool = require("./db");

async function createAdmin() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.log("사용법: node create-admin.js 아이디 비밀번호");
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO admins (username, password_hash, role)
      VALUES ($1, $2, 'admin')
      ON CONFLICT (username)
      DO UPDATE SET password_hash = $2
      `,
      [username, passwordHash]
    );

    console.log("✅ 관리자 계정 생성 완료");
    console.log(`아이디: ${username}`);
  } catch (error) {
    console.error("❌ 관리자 계정 생성 실패");
    console.error(error);
  } finally {
    await pool.end();
  }
}

createAdmin();