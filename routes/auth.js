const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const pool = require("../db");
const SUPER_ADMIN_EMAIL = "dong.yoon.lee616@gmail.com";
const crypto = require("crypto");
const { Resend } = require("resend");
const { logAccount } = require("../utils/discord-log");

function hashPasswordResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendPasswordResetEmail(to, resetUrl) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM || "SchoolHub <onboarding@resend.dev>",
    to: [to],
    subject: "SchoolHub 비밀번호 재설정",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.7;">
        <h2>SchoolHub 비밀번호 재설정</h2>

        <p>아래 버튼을 눌러 새 비밀번호를 설정해주세요.</p>

        <p>
          <a
            href="${resetUrl}"
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
            비밀번호 재설정하기
          </a>
        </p>

        <p>이 링크는 30분 동안만 유효합니다.</p>
        <p>본인이 요청하지 않았다면 이 메일은 무시해도 됩니다.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || "비밀번호 재설정 메일 발송 오류");
  }
}

function redirectIfLoggedIn(req, res, next) {
  if (req.session.user) {
    return res.redirect("/");
  }

  next();
}

router.get("/register", redirectIfLoggedIn, (req, res) => {
  res.render("auth/register", {
    school: null,
    error: null,
    form: {
      nickname: "",
      email: "",
    },
  });
});

router.post("/register", redirectIfLoggedIn, async (req, res) => {
  try {
    const { nickname, email, password, passwordConfirm } = req.body;

    const trimmedNickname = nickname ? nickname.trim() : "";
    const trimmedEmail = email ? email.trim().toLowerCase() : "";

    if (!trimmedNickname || !trimmedEmail || !password || !passwordConfirm) {
      return res.render("auth/register", {
        school: null,
        error: "닉네임, 이메일, 비밀번호를 모두 입력해주세요.",
        form: {
          nickname: trimmedNickname,
          email: trimmedEmail,
        },
      });
    }

    if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
      return res.render("auth/register", {
        school: null,
        error: "닉네임은 2자 이상 20자 이하로 입력해주세요.",
        form: {
          nickname: trimmedNickname,
          email: trimmedEmail,
        },
      });
    }

    if (password.length < 6) {
      return res.render("auth/register", {
        school: null,
        error: "비밀번호는 6자 이상으로 입력해주세요.",
        form: {
          nickname: trimmedNickname,
          email: trimmedEmail,
        },
      });
    }

    if (password !== passwordConfirm) {
      return res.render("auth/register", {
        school: null,
        error: "비밀번호 확인이 일치하지 않습니다.",
        form: {
          nickname: trimmedNickname,
          email: trimmedEmail,
        },
      });
    }

    const duplicateResult = await pool.query(
      `
      SELECT id, nickname, email
      FROM app_users
      WHERE email = $1 OR nickname = $2
      `,
      [trimmedEmail, trimmedNickname]
    );

    if (duplicateResult.rows.length > 0) {
      const duplicateUser = duplicateResult.rows[0];

      const message =
        duplicateUser.email === trimmedEmail
          ? "이미 사용 중인 이메일입니다."
          : "이미 사용 중인 닉네임입니다.";

      return res.render("auth/register", {
        school: null,
        error: message,
        form: {
          nickname: trimmedNickname,
          email: trimmedEmail,
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const role =
      trimmedEmail === SUPER_ADMIN_EMAIL
        ? "superadmin"
        : "user";

    const userResult = await pool.query(
      `
      INSERT INTO app_users (nickname, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nickname, email, role
      `,
      [trimmedNickname, trimmedEmail, passwordHash, role]
    );

    const newUser = userResult.rows[0];

    await logAccount(req, {
      action: "회원가입",
      target: `유저 ID: ${newUser.id}`,
      detail: "새 계정이 생성되었습니다.",
      fields: [
        {
          name: "이메일",
          value: newUser.email,
          inline: true,
        },
        {
          name: "닉네임",
          value: newUser.nickname,
          inline: true,
        },
        {
          name: "권한",
          value: newUser.role,
          inline: true,
        },
      ],
    });

    req.session.user = {
      id: newUser.id,
      nickname: newUser.nickname,
      email: newUser.email,
      role: newUser.role,
    };

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("회원가입 중 오류가 발생했습니다.");
  }
});

router.get("/login", redirectIfLoggedIn, (req, res) => {
  res.render("auth/login", {
    school: null,
    error: null,
    form: {
      email: "",
    },
  });

  router.get("/login", (req, res) => {
    res.render("auth/login", {
      error: null,
      passwordReset: req.query.passwordReset === "1",
    });
  });
});

router.post("/login", redirectIfLoggedIn, async (req, res) => {
  try {
    const { email, password } = req.body;

    const trimmedEmail = email ? email.trim().toLowerCase() : "";

    if (!trimmedEmail || !password) {
      return res.render("auth/login", {
        school: null,
        error: "이메일과 비밀번호를 입력해주세요.",
        form: {
          email: trimmedEmail,
        },
      });
    }

    const result = await pool.query(
      `
      SELECT id, nickname, email, password_hash, role
      FROM app_users
      WHERE email = $1
      `,
      [trimmedEmail]
    );

    if (result.rows.length === 0) {
      return res.render("auth/login", {
        school: null,
        error: "이메일 또는 비밀번호가 올바르지 않습니다.",
        form: {
          email: trimmedEmail,
        },
      });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.render("auth/login", {
        school: null,
        error: "이메일 또는 비밀번호가 올바르지 않습니다.",
        passwordReset: false,
        form: {
          email: trimmedEmail,
        },
      });
    }

    req.session.user = {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
    };

    await logAccount(req, {
      action: "로그인",
      target: `유저 ID: ${user.id}`,
      detail: "사용자가 로그인했습니다.",
    });

    if (user.role === "superadmin") {
      return res.redirect("/superadmin");
    }

    if (user.role === "admin") {
      return res.redirect("/admin");
    }

res.redirect("/");

    res.redirect("/");

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("로그인 중 오류가 발생했습니다.");
  }
});

router.post("/logout", (req, res) => {
  req.session.user = null;
  res.redirect("/");
});

router.get("/forgot-password", (req, res) => {
  res.render("auth/forgot-password", {
    error: null,
    success: null,
  });
});

router.post("/forgot-password", async (req, res) => {
  try {
    const emailValue = req.body.email ? req.body.email.trim().toLowerCase() : "";

    if (!emailValue) {
      return res.render("auth/forgot-password", {
        error: "이메일을 입력해주세요.",
        success: null,
      });
    }

    const userResult = await pool.query(
      `
      SELECT id, email, email_verified
      FROM app_users
      WHERE LOWER(email) = $1
      `,
      [emailValue]
    );

    // 보안상 계정이 없거나 이메일 인증이 안 되어 있어도 같은 메시지를 보여줌
    if (userResult.rows.length === 0 || !userResult.rows[0].email_verified) {
      return res.render("auth/forgot-password", {
        error: null,
        success: "비밀번호 재설정이 가능한 계정이라면 이메일을 보냈습니다.",
      });
    }

    const user = userResult.rows[0];

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      `
      UPDATE app_users
      SET password_reset_token_hash = $1,
          password_reset_expires_at = $2
      WHERE id = $3
      `,
      [tokenHash, expiresAt, user.id]
    );

    await logAccount(req, {
      action: "비밀번호 재설정",
      target: `유저 ID: ${user.id}`,
      detail: "사용자가 이메일 링크를 통해 비밀번호를 재설정했습니다.",
    });

    const baseUrl =
      process.env.APP_BASE_URL ||
      `${req.protocol}://${req.get("host")}`;

    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail(user.email, resetUrl);

    res.render("auth/forgot-password", {
      error: null,
      success: "비밀번호 재설정 이메일을 보냈습니다. 메일함을 확인해주세요.",
    });
  } catch (error) {
    console.error("비밀번호 재설정 메일 발송 오류:", error);

    res.status(500).render("auth/forgot-password", {
      error: "비밀번호 재설정 메일을 보내는 중 오류가 발생했습니다.",
      success: null,
    });
  }
});

router.get("/reset-password", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send("재설정 토큰이 없습니다.");
    }

    const tokenHash = hashPasswordResetToken(token);

    const userResult = await pool.query(
      `
      SELECT id
      FROM app_users
      WHERE password_reset_token_hash = $1
        AND password_reset_expires_at > CURRENT_TIMESTAMP
      `,
      [tokenHash]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).send("유효하지 않거나 만료된 재설정 링크입니다.");
    }

    res.render("auth/reset-password", {
      token,
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("비밀번호 재설정 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword, newPasswordConfirm } = req.body;

    if (!token) {
      return res.status(400).send("재설정 토큰이 없습니다.");
    }

    if (!newPassword || !newPasswordConfirm) {
      return res.render("auth/reset-password", {
        token,
        error: "새 비밀번호를 모두 입력해주세요.",
      });
    }

    if (newPassword.length < 6) {
      return res.render("auth/reset-password", {
        token,
        error: "비밀번호는 6자 이상이어야 합니다.",
      });
    }

    if (newPassword !== newPasswordConfirm) {
      return res.render("auth/reset-password", {
        token,
        error: "새 비밀번호 확인이 일치하지 않습니다.",
      });
    }

    const tokenHash = hashPasswordResetToken(token);

    const userResult = await pool.query(
      `
      SELECT id
      FROM app_users
      WHERE password_reset_token_hash = $1
        AND password_reset_expires_at > CURRENT_TIMESTAMP
      `,
      [tokenHash]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).send("유효하지 않거나 만료된 재설정 링크입니다.");
    }

    const user = userResult.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
      UPDATE app_users
      SET password_hash = $1,
          password_reset_token_hash = NULL,
          password_reset_expires_at = NULL
      WHERE id = $2
      `,
      [passwordHash, user.id]
    );

    await logAccount(req, {
      action: "비밀번호 재설정",
      target: `유저 ID: ${user.id}`,
      detail: "사용자가 기존 비밀번호를 통해 비밀번호를 재설정했습니다.",
    });

    res.redirect("/login?passwordReset=1");
  } catch (error) {
    console.error(error);
    res.status(500).send("비밀번호를 재설정하는 중 오류가 발생했습니다.");
  }
});

module.exports = router;