const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const pool = require("../db");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const dns = require("dns").promises;

function hashEmailToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendVerificationEmail(to, verificationUrl) {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    throw new Error("SMTP 환경변수가 설정되지 않았습니다.");
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT);

  const ipv4Addresses = await dns.resolve4(smtpHost);

  if (!ipv4Addresses || ipv4Addresses.length === 0) {
    throw new Error("SMTP IPv4 주소를 찾을 수 없습니다.");
  }

  const smtpIPv4 = ipv4Addresses[0];

  const transporter = nodemailer.createTransport({
    host: smtpIPv4,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort === 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      servername: smtpHost,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "SchoolHub 이메일 인증",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.7;">
        <h2>SchoolHub 이메일 인증</h2>
        <p>아래 버튼을 눌러 이메일 인증을 완료해주세요.</p>

        <p>
          <a
            href="${verificationUrl}"
            style="
              display: inline-block;
              padding: 12px 18px;
              background: #3b5bdb;
              color: white;
              text-decoration: none;
              border-radius: 10px;
              font-weight: bold;
            "
          >
            이메일 인증하기
          </a>
        </p>

        <p>이 링크는 30분 동안만 유효합니다.</p>
      </div>
    `,
  });
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

const STATUS_LABELS = { pending: "승인 대기", approved: "공개됨", rejected: "반려됨" };
const LOST_STATUS_LABELS = { lost: "보관중", returned: "수령완료" };
const SUPPORT_TYPE_LABELS = {
  suggestion: "건의 사항",
  inquiry: "문의 사항",
  bug: "버그 제보",
  other: "기타 문의",
};
const SUPPORT_STATUS_LABELS = { pending: "미접수", resolved: "접수완료" };

router.get("/mypage", requireLogin, (req, res) => {
  res.redirect("/mypage/activity");
});

router.get("/mypage/activity", requireLogin, async (req, res) => {
  try {
    const user = req.session.user;

    const postsResult = await pool.query(
      `
      SELECT posts.*, schools.name AS school_name, schools.slug AS school_slug
      FROM posts
      JOIN schools ON posts.school_id = schools.id
      WHERE posts.user_id = $1
      ORDER BY posts.created_at DESC
      `,
      [user.id]
    );

    const commentsResult = await pool.query(
      `
      SELECT
        comments.*,
        posts.title AS post_title,
        posts.status AS post_status,
        schools.name AS school_name,
        schools.slug AS school_slug
      FROM comments
      JOIN posts ON comments.post_id = posts.id
      JOIN schools ON comments.school_id = schools.id
      WHERE comments.user_id = $1
      ORDER BY comments.created_at DESC
      `,
      [user.id]
    );

    const lostItemsResult = await pool.query(
      `
      SELECT lost_items.*, schools.name AS school_name, schools.slug AS school_slug
      FROM lost_items
      JOIN schools ON lost_items.school_id = schools.id
      WHERE lost_items.user_id = $1
      ORDER BY lost_items.created_at DESC
      `,
      [user.id]
    );

    res.render("mypage/activity", {
      school: null,
      user,
      posts: postsResult.rows,
      comments: commentsResult.rows,
      lostItems: lostItemsResult.rows,
      statusLabels: STATUS_LABELS,
      lostStatusLabels: LOST_STATUS_LABELS,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("내 활동을 불러오는 중 오류가 발생했습니다.");
  }
});

router.get("/mypage/support", requireLogin, async (req, res) => {
  try {
    const user = req.session.user;

    const supportResult = await pool.query(
      `
      SELECT *
      FROM support_tickets
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [user.id]
    );

    res.render("mypage/support", {
      school: null,
      user,
      tickets: supportResult.rows,
      supportTypeLabels: SUPPORT_TYPE_LABELS,
      supportStatusLabels: SUPPORT_STATUS_LABELS,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("내 문의를 불러오는 중 오류가 발생했습니다.");
  }
});

router.get("/mypage/account", requireLogin, async (req, res) => {
  try {
    const user = req.session.user;

    const userResult = await pool.query(
      `
      SELECT id, nickname, email, role, email_verified, created_at
      FROM app_users
      WHERE id = $1
      `,
      [user.id]
    );

    if (userResult.rows.length === 0) {
      req.session.user = null;
      return res.redirect("/login");
    }

    res.render("mypage/account", {
      school: null,
      user,
      account: userResult.rows[0],
      emailVerifySent: req.query.emailVerifySent === "1",
      emailVerified: req.query.emailVerified === "1",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("계정 정보를 불러오는 중 오류가 발생했습니다.");
  }
});

router.get("/mypage/password", requireLogin, (req, res) => {
  res.render("mypage/password", {
    school: null,
    user: req.session.user,
    error: null,
    success: null,
  });
});

router.post("/mypage/password", requireLogin, async (req, res) => {
  try {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;
    const user = req.session.user;

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return res.render("mypage/password", {
        school: null,
        user,
        error: "현재 비밀번호와 새 비밀번호를 모두 입력해주세요.",
        success: null,
      });
    }

    if (newPassword.length < 6) {
      return res.render("mypage/password", {
        school: null,
        user,
        error: "새 비밀번호는 6자 이상이어야 합니다.",
        success: null,
      });
    }

    if (newPassword !== newPasswordConfirm) {
      return res.render("mypage/password", {
        school: null,
        user,
        error: "새 비밀번호 확인이 일치하지 않습니다.",
        success: null,
      });
    }

    const userResult = await pool.query(
      `
      SELECT password_hash
      FROM app_users
      WHERE id = $1
      `,
      [user.id]
    );

    if (userResult.rows.length === 0) {
      req.session.user = null;
      return res.redirect("/login");
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );

    if (!isMatch) {
      return res.render("mypage/password", {
        school: null,
        user,
        error: "현재 비밀번호가 올바르지 않습니다.",
        success: null,
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
      UPDATE app_users
      SET password_hash = $1
      WHERE id = $2
      `,
      [newPasswordHash, user.id]
    );

    res.render("mypage/password", {
      school: null,
      user,
      error: null,
      success: "비밀번호가 변경되었습니다.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("비밀번호를 변경하는 중 오류가 발생했습니다.");
  }
});

router.post("/mypage/delete", requireLogin, async (req, res) => {
  try {
    const user = req.session.user;

    await pool.query(
      `
      DELETE FROM app_users
      WHERE id = $1
      `,
      [user.id]
    );

    req.session.destroy((error) => {
      if (error) {
        console.error(error);
        return res.status(500).send("계정 삭제 후 로그아웃하는 중 오류가 발생했습니다.");
      }

      res.redirect("/");
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("계정을 삭제하는 중 오류가 발생했습니다.");
  }
});

router.post("/mypage/email/verify-request", requireLogin, async (req, res) => {
  try {
    const user = req.session.user;

    const userResult = await pool.query(
      `
      SELECT id, email, email_verified
      FROM app_users
      WHERE id = $1
      `,
      [user.id]
    );

    if (userResult.rows.length === 0) {
      req.session.user = null;
      return res.redirect("/login");
    }

    const account = userResult.rows[0];

    if (account.email_verified) {
      return res.redirect("/mypage/account?emailVerified=1");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashEmailToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      `
      UPDATE app_users
      SET email_verification_token_hash = $1,
          email_verification_expires_at = $2
      WHERE id = $3
      `,
      [tokenHash, expiresAt, user.id]
    );

    const baseUrl =
      process.env.APP_BASE_URL ||
      `${req.protocol}://${req.get("host")}`;

    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;

    await sendVerificationEmail(account.email, verificationUrl);

    res.redirect("/mypage/account?emailVerifySent=1");
  } catch (error) {
    console.error(error);
    res.status(500).send("이메일 인증 메일을 보내는 중 오류가 발생했습니다.");
  }
});

router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send("인증 토큰이 없습니다.");
    }

    const tokenHash = hashEmailToken(token);

    const userResult = await pool.query(
      `
      SELECT id
      FROM app_users
      WHERE email_verification_token_hash = $1
        AND email_verification_expires_at > CURRENT_TIMESTAMP
      `,
      [tokenHash]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).send("유효하지 않거나 만료된 인증 링크입니다.");
    }

    const verifiedUser = userResult.rows[0];

    await pool.query(
      `
      UPDATE app_users
      SET email_verified = true,
          email_verified_at = CURRENT_TIMESTAMP,
          email_verification_token_hash = NULL,
          email_verification_expires_at = NULL
      WHERE id = $1
      `,
      [verifiedUser.id]
    );

    if (
      req.session.user &&
      Number(req.session.user.id) === Number(verifiedUser.id)
    ) {
      return res.redirect("/mypage/account?emailVerified=1");
    }

    res.send("이메일 인증이 완료되었습니다. SchoolHub에 다시 로그인해주세요.");
  } catch (error) {
    console.error(error);
    res.status(500).send("이메일 인증 중 오류가 발생했습니다.");
  }
});

module.exports = router;
