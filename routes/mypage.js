const express = require("express");
const router = express.Router();
const pool = require("../db");

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
      SELECT id, nickname, email, role, created_at
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

    const countsResult = await pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM posts WHERE user_id = $1) AS posts_count,
        (SELECT COUNT(*) FROM comments WHERE user_id = $1) AS comments_count,
        (SELECT COUNT(*) FROM lost_items WHERE user_id = $1) AS lost_items_count,
        (SELECT COUNT(*) FROM support_tickets WHERE user_id = $1) AS support_count
      `,
      [user.id]
    );

    res.render("mypage/account", {
      school: null,
      user,
      account,
      counts: countsResult.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("계정 정보를 불러오는 중 오류가 발생했습니다.");
  }
});

module.exports = router;
