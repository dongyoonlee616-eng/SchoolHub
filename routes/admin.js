const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const pool = require("../db");

function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }

  next();
}

// 관리자 로그인 페이지
router.get("/admin/login", (req, res) => {
  res.render("admin/login", {
    error: null,
  });
});

// 관리자 로그인 처리
router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render("admin/login", {
        error: "아이디와 비밀번호를 모두 입력하세요.",
      });
    }

    const result = await pool.query(
      "SELECT * FROM admins WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.render("admin/login", {
        error: "아이디 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    const admin = result.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      return res.render("admin/login", {
        error: "아이디 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    req.session.admin = {
      id: admin.id,
      username: admin.username,
      role: admin.role,
    };

    res.redirect("/admin");
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 로그인 중 오류가 발생했습니다.");
  }
});

// 관리자 로그아웃
router.post("/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

// 관리자 대시보드
router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const pendingPostsResult = await pool.query(
      "SELECT COUNT(*) FROM posts WHERE status = 'pending'"
    );

    const pendingCommentsResult = await pool.query(
      "SELECT COUNT(*) FROM comments WHERE status = 'pending'"
    );

    const pendingLostItemsResult = await pool.query(
      "SELECT COUNT(*) FROM lost_items WHERE status = 'pending'"
    );

    res.render("admin/dashboard", {
      admin: req.session.admin,
      pendingPostsCount: pendingPostsResult.rows[0].count,
      pendingCommentsCount: pendingCommentsResult.rows[0].count,
      pendingLostItemsCount: pendingLostItemsResult.rows[0].count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 승인 대기 게시글 목록
router.get("/admin/posts/pending", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        posts.id,
        posts.title,
        posts.nickname,
        posts.created_at,
        schools.name AS school_name
      FROM posts
      JOIN schools ON posts.school_id = schools.id
      WHERE posts.status = 'pending'
      ORDER BY posts.created_at DESC
      `
    );

    res.render("admin/pending-posts", {
      admin: req.session.admin,
      posts: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("승인 대기 게시글을 불러오는 중 오류가 발생했습니다.");
  }
});

// 승인 대기 게시글 상세
router.get("/admin/posts/pending/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        posts.*,
        schools.name AS school_name
      FROM posts
      JOIN schools ON posts.school_id = schools.id
      WHERE posts.id = $1
      AND posts.status = 'pending'
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("존재하지 않는 승인 대기 게시글입니다.");
    }

    res.render("admin/pending-post-detail", {
      admin: req.session.admin,
      post: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("승인 대기 게시글 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 게시글 승인
router.post("/admin/posts/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE posts
      SET status = 'approved',
          approved_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [id]
    );

    res.redirect("/admin/posts/pending");
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 승인 중 오류가 발생했습니다.");
  }
});

// 게시글 삭제
router.post("/admin/posts/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM posts WHERE id = $1",
      [id]
    );

    res.redirect("/admin/posts/pending");
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 삭제 중 오류가 발생했습니다.");
  }
});

// 공지사항 관리 목록
router.get("/admin/notices", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        notices.*,
        schools.name AS school_name
      FROM notices
      JOIN schools ON notices.school_id = schools.id
      ORDER BY notices.is_pinned DESC, notices.created_at DESC
      `
    );

    res.render("admin/notices", {
      admin: req.session.admin,
      notices: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항 목록을 불러오는 중 오류가 발생했습니다.");
  }
});

// 공지사항 작성 페이지
router.get("/admin/notices/new", requireAdmin, async (req, res) => {
  try {
    const schoolsResult = await pool.query(
      "SELECT * FROM schools ORDER BY id ASC"
    );

    res.render("admin/notice-new", {
      admin: req.session.admin,
      schools: schoolsResult.rows,
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항 작성 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 공지사항 작성 처리
router.post("/admin/notices", requireAdmin, async (req, res) => {
  try {
    const { school_id, title, content } = req.body;
    const isPinned = req.body.is_pinned === "on";

    if (!school_id || !title || !content) {
      const schoolsResult = await pool.query(
        "SELECT * FROM schools ORDER BY id ASC"
      );

      return res.render("admin/notice-new", {
        admin: req.session.admin,
        schools: schoolsResult.rows,
        error: "학교, 제목, 내용을 모두 입력하세요.",
      });
    }

    await pool.query(
        `
        INSERT INTO notices (school_id, title, content, is_pinned)
        VALUES ($1, $2, $3, $4)
        `,
        [school_id, title, content, isPinned]
    );

    res.redirect("/admin/notices");
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항을 저장하는 중 오류가 발생했습니다.");
  }
});

// 공지사항 수정 페이지
router.get("/admin/notices/:id/edit", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const noticeResult = await pool.query(
      "SELECT * FROM notices WHERE id = $1",
      [id]
    );

    if (noticeResult.rows.length === 0) {
      return res.status(404).send("존재하지 않는 공지사항입니다.");
    }

    const schoolsResult = await pool.query(
      "SELECT * FROM schools ORDER BY id ASC"
    );

    res.render("admin/notice-edit", {
      admin: req.session.admin,
      notice: noticeResult.rows[0],
      schools: schoolsResult.rows,
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항 수정 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 공지사항 수정 처리
router.post("/admin/notices/:id/edit", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { school_id, title, content } = req.body;
    const isPinned = req.body.is_pinned === "on";

    if (!school_id || !title || !content) {
      const noticeResult = await pool.query(
        "SELECT * FROM notices WHERE id = $1",
        [id]
      );

      const schoolsResult = await pool.query(
        "SELECT * FROM schools ORDER BY id ASC"
      );

      return res.render("admin/notice-edit", {
        admin: req.session.admin,
        notice: noticeResult.rows[0],
        schools: schoolsResult.rows,
        error: "학교, 제목, 내용을 모두 입력하세요.",
      });
    }

    await pool.query(
        `
        UPDATE notices
        SET school_id = $1,
            title = $2,
            content = $3,
            is_pinned = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        `,
        [school_id, title, content, isPinned, id]
    );

    res.redirect("/admin/notices");
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항을 수정하는 중 오류가 발생했습니다.");
  }
});

// 공지사항 삭제
router.post("/admin/notices/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM notices WHERE id = $1",
      [id]
    );

    res.redirect("/admin/notices");
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항을 삭제하는 중 오류가 발생했습니다.");
  }
});

// 건의사항 목록
router.get("/admin/suggestions", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM suggestions
      ORDER BY created_at DESC
      `
    );

    res.render("admin/suggestions", {
      admin: req.session.admin,
      suggestions: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("건의사항 목록을 불러오는 중 오류가 발생했습니다.");
  }
});

// 건의사항 확인 처리
router.post("/admin/suggestions/:id/read", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE suggestions
      SET status = 'read'
      WHERE id = $1
      `,
      [id]
    );

    res.redirect("/admin/suggestions");
  } catch (error) {
    console.error(error);
    res.status(500).send("건의사항 확인 처리 중 오류가 발생했습니다.");
  }
});

// 건의사항 삭제
router.post("/admin/suggestions/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM suggestions WHERE id = $1",
      [id]
    );

    res.redirect("/admin/suggestions");
  } catch (error) {
    console.error(error);
    res.status(500).send("건의사항 삭제 중 오류가 발생했습니다.");
  }
});

// 승인 대기 댓글 목록
router.get("/admin/comments/pending", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        comments.*,
        posts.title AS post_title,
        schools.name AS school_name
      FROM comments
      JOIN posts ON comments.post_id = posts.id
      JOIN schools ON comments.school_id = schools.id
      WHERE comments.status = 'pending'
      ORDER BY comments.created_at DESC
      `
    );

    res.render("admin/pending-comments", {
      admin: req.session.admin,
      comments: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("승인 대기 댓글을 불러오는 중 오류가 발생했습니다.");
  }
});

// 승인 대기 댓글 상세 검토
router.get("/admin/comments/pending/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        comments.*,
        posts.title AS post_title,
        posts.content AS post_content,
        posts.nickname AS post_nickname,
        posts.created_at AS post_created_at,
        schools.name AS school_name,
        schools.slug AS school_slug
      FROM comments
      JOIN posts ON comments.post_id = posts.id
      JOIN schools ON comments.school_id = schools.id
      WHERE comments.id = $1
      AND comments.status = 'pending'
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("존재하지 않는 승인 대기 댓글입니다.");
    }

    res.render("admin/comment-review", {
      admin: req.session.admin,
      item: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("댓글 검토 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 댓글 승인
router.post("/admin/comments/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE comments
      SET status = 'approved',
          approved_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [id]
    );

    res.redirect("/admin/comments/pending");
  } catch (error) {
    console.error(error);
    res.status(500).send("댓글 승인 중 오류가 발생했습니다.");
  }
});

// 댓글 삭제
router.post("/admin/comments/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM comments WHERE id = $1",
      [id]
    );

    res.redirect("/admin/comments/pending");
  } catch (error) {
    console.error(error);
    res.status(500).send("댓글 삭제 중 오류가 발생했습니다.");
  }
});

// 관리자 전용 게시판 목록
router.get("/admin/board", requireAdmin, async (req, res) => {
  try {
    const { q, status } = req.query;

    const conditions = [];
    const values = [];

    let selectedStatus = "";

    if (status && ["pending", "approved"].includes(status)) {
      values.push(status);
      conditions.push(`posts.status = $${values.length}`);
      selectedStatus = status;
    }

    let searchQuery = "";

    if (q && q.trim().length > 0) {
      searchQuery = q.trim();
      values.push(`%${searchQuery}%`);

      conditions.push(`
        (
          posts.title ILIKE $${values.length}
          OR posts.content ILIKE $${values.length}
          OR posts.nickname ILIKE $${values.length}
        )
      `);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `
      SELECT
        posts.*,
        schools.name AS school_name,
        COUNT(comments.id) AS comment_count
      FROM posts
      JOIN schools ON posts.school_id = schools.id
      LEFT JOIN comments ON comments.post_id = posts.id
      ${whereClause}
      GROUP BY posts.id, schools.name
      ORDER BY posts.created_at DESC
      `,
      values
    );

    res.render("admin/board", {
      admin: req.session.admin,
      posts: result.rows,
      searchQuery,
      selectedStatus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 게시판을 불러오는 중 오류가 발생했습니다.");
  }
});

// 관리자 전용 게시글 상세
router.get("/admin/board/posts/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const postResult = await pool.query(
      `
      SELECT
        posts.*,
        schools.name AS school_name,
        schools.slug AS school_slug
      FROM posts
      JOIN schools ON posts.school_id = schools.id
      WHERE posts.id = $1
      `,
      [id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).send("존재하지 않는 게시글입니다.");
    }

    const commentsResult = await pool.query(
      `
      SELECT *
      FROM comments
      WHERE post_id = $1
      ORDER BY created_at ASC
      `,
      [id]
    );

    res.render("admin/board-post-detail", {
      admin: req.session.admin,
      post: postResult.rows[0],
      comments: commentsResult.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 게시글 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 관리자 게시글 삭제
router.post("/admin/board/posts/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM posts WHERE id = $1",
      [id]
    );

    res.redirect("/admin/board");
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 삭제 중 오류가 발생했습니다.");
  }
});

// 관리자 댓글 삭제
router.post("/admin/board/comments/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const commentResult = await pool.query(
      "SELECT post_id FROM comments WHERE id = $1",
      [id]
    );

    if (commentResult.rows.length === 0) {
      return res.redirect("/admin/board");
    }

    const postId = commentResult.rows[0].post_id;

    await pool.query(
      "DELETE FROM comments WHERE id = $1",
      [id]
    );

    res.redirect(`/admin/board/posts/${postId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("댓글 삭제 중 오류가 발생했습니다.");
  }
});

// 관리자 분실물 관리 목록
router.get("/admin/lost-items", requireAdmin, async (req, res) => {
  try {
    const { q, status } = req.query;

    const conditions = [];
    const values = [];

    let searchQuery = "";
    let selectedStatus = "";

    if (status && ["pending", "approved"].includes(status)) {
      values.push(status);
      conditions.push(`lost_items.status = $${values.length}`);
      selectedStatus = status;
    }

    if (q && q.trim().length > 0) {
      searchQuery = q.trim();
      values.push(`%${searchQuery}%`);

      conditions.push(`
        (
          lost_items.title ILIKE $${values.length}
          OR lost_items.content ILIKE $${values.length}
          OR lost_items.found_place ILIKE $${values.length}
          OR lost_items.pickup_place ILIKE $${values.length}
          OR lost_items.nickname ILIKE $${values.length}
        )
      `);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `
      SELECT
        lost_items.*,
        schools.name AS school_name
      FROM lost_items
      JOIN schools ON lost_items.school_id = schools.id
      ${whereClause}
      ORDER BY lost_items.created_at DESC
      `,
      values
    );

    res.render("admin/lost-items", {
      admin: req.session.admin,
      items: result.rows,
      searchQuery,
      selectedStatus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 분실물 목록을 불러오는 중 오류가 발생했습니다.");
  }
});

// 승인 대기 분실물 목록
router.get("/admin/lost-items/pending", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        lost_items.*,
        schools.name AS school_name
      FROM lost_items
      JOIN schools ON lost_items.school_id = schools.id
      WHERE lost_items.status = 'pending'
      ORDER BY lost_items.created_at DESC
      `
    );

    res.render("admin/pending-lost-items", {
      admin: req.session.admin,
      items: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("승인 대기 분실물을 불러오는 중 오류가 발생했습니다.");
  }
});

// 승인 대기 분실물 상세
router.get("/admin/lost-items/pending/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        lost_items.*,
        schools.name AS school_name
      FROM lost_items
      JOIN schools ON lost_items.school_id = schools.id
      WHERE lost_items.id = $1
      AND lost_items.status = 'pending'
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("존재하지 않는 승인 대기 분실물입니다.");
    }

    res.render("admin/pending-lost-item-detail", {
      admin: req.session.admin,
      item: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("승인 대기 분실물 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 분실물 승인
router.post("/admin/lost-items/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE lost_items
      SET status = 'approved',
          approved_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [id]
    );

    res.redirect("/admin/lost-items/pending");
  } catch (error) {
    console.error(error);
    res.status(500).send("분실물 승인 중 오류가 발생했습니다.");
  }
});

// 관리자 분실물 상세
router.get("/admin/lost-items/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        lost_items.*,
        schools.name AS school_name
      FROM lost_items
      JOIN schools ON lost_items.school_id = schools.id
      WHERE lost_items.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("존재하지 않는 분실물입니다.");
    }

    res.render("admin/lost-item-detail", {
      admin: req.session.admin,
      item: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 분실물 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 분실물 승인
router.post("/admin/lost-items/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE lost_items
      SET status = 'approved',
          approved_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [id]
    );

    res.redirect(`/admin/lost-items/${id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("분실물 승인 중 오류가 발생했습니다.");
  }
});

// 분실물 삭제
router.post("/admin/lost-items/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM lost_items WHERE id = $1",
      [id]
    );

    res.redirect("/admin/lost-items");
  } catch (error) {
    console.error(error);
    res.status(500).send("분실물 삭제 중 오류가 발생했습니다.");
  }
});

module.exports = router;