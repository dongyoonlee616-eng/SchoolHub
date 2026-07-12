const express = require("express");
const router = express.Router();
const pool = require("../db");

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
}

const STATUS_LABELS = {
  pending: "승인 대기",
  approved: "공개됨",
  rejected: "반려됨",
};

const LOST_STATUS_LABELS = {
  lost: "보관중",
  returned: "수령완료",
};

router.get("/mypage", requireLogin, async (req, res) => {
  try {
    const user = req.session.user;

    const postsResult = await pool.query(
      `
      SELECT
        posts.*,
        schools.name AS school_name,
        schools.slug AS school_slug
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
      SELECT
        lost_items.*,
        schools.name AS school_name,
        schools.slug AS school_slug
      FROM lost_items
      JOIN schools ON lost_items.school_id = schools.id
      WHERE lost_items.user_id = $1
      ORDER BY lost_items.created_at DESC
      `,
      [user.id]
    );

    res.render("mypage", {
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
    res.status(500).send("마이페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

module.exports = router;
