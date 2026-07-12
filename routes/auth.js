const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const pool = require("../db");

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

    const insertResult = await pool.query(
      `
      INSERT INTO app_users (nickname, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, nickname, email, role
      `,
      [trimmedNickname, trimmedEmail, passwordHash]
    );

    const user = insertResult.rows[0];

    req.session.user = {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
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

module.exports = router;