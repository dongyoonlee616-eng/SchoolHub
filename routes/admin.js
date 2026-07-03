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

async function getAdminSchoolBySlug(slug) {
  const result = await pool.query(
    "SELECT * FROM schools WHERE slug = $1",
    [slug]
  );

  return result.rows[0];
}

function renderAdminSchoolNotFound(res) {
  return res.status(404).render("404", {
    title: "학교를 찾을 수 없습니다.",
    message: "존재하지 않는 학교입니다.",
    backLabel: "관리자 메인으로 돌아가기",
    backUrl: "/admin",
  });
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

// 관리자 메인 - 학교 선택 페이지
router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        schools.*,
        (SELECT COUNT(*) FROM posts WHERE posts.school_id = schools.id) AS posts_count,
        (SELECT COUNT(*) FROM comments WHERE comments.school_id = schools.id) AS comments_count,
        (SELECT COUNT(*) FROM notices WHERE notices.school_id = schools.id) AS notices_count,
        (SELECT COUNT(*) FROM lost_items WHERE lost_items.school_id = schools.id) AS lost_items_count
      FROM schools
      ORDER BY name ASC, id ASC
    `);

    res.render("admin/dashboard", {
      admin: req.session.admin,
      schools: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 메인 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 관리자 대시보드
router.get("/admin/schools/:slug/dashboard", requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const pendingPostsResult = await pool.query(
      "SELECT COUNT(*) FROM posts WHERE school_id = $1 AND status = 'pending'",
      [school.id]
    );

    const pendingCommentsResult = await pool.query(
      "SELECT COUNT(*) FROM comments WHERE school_id = $1 AND status = 'pending'",
      [school.id]
    );

    const pendingLostItemsResult = await pool.query(
      "SELECT COUNT(*) FROM lost_items WHERE school_id = $1 AND status = 'pending'",
      [school.id]
    );

    const approvedPostsResult = await pool.query(
      "SELECT COUNT(*) FROM posts WHERE school_id = $1 AND status = 'approved'",
      [school.id]
    );

    const noticesResult = await pool.query(
      "SELECT COUNT(*) FROM notices WHERE school_id = $1",
      [school.id]
    );

    const lostItemsResult = await pool.query(
      "SELECT COUNT(*) FROM lost_items WHERE school_id = $1",
      [school.id]
    );

    res.render("admin/school-dashboard", {
      admin: req.session.admin,
      school,
      pendingPostsCount: pendingPostsResult.rows[0].count,
      pendingCommentsCount: pendingCommentsResult.rows[0].count,
      pendingLostItemsCount: pendingLostItemsResult.rows[0].count,
      approvedPostsCount: approvedPostsResult.rows[0].count,
      noticesCount: noticesResult.rows[0].count,
      lostItemsCount: lostItemsResult.rows[0].count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("학교별 관리자 대시보드를 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 승인 대기 게시글 목록
router.get("/admin/schools/:slug/posts/pending", requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT posts.*, schools.name AS school_name, schools.slug AS school_slug
      FROM posts
      JOIN schools ON posts.school_id = schools.id
      WHERE posts.school_id = $1 AND posts.status = 'pending'
      ORDER BY posts.created_at DESC
      `,
      [school.id]
    );

    res.render("admin/pending-posts", {
      admin: req.session.admin,
      school,
      posts: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("승인 대기 게시글을 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 승인 대기 게시글 상세
router.get("/admin/schools/:slug/posts/pending/:id", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT posts.*, schools.name AS school_name, schools.slug AS school_slug
      FROM posts
      JOIN schools ON posts.school_id = schools.id
      WHERE posts.id = $1
        AND posts.school_id = $2
        AND posts.status = 'pending'
      `,
      [id, school.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).render("404", {
        title: "게시글을 찾을 수 없습니다.",
        message: "존재하지 않거나 이미 처리된 게시글입니다.",
        backLabel: "승인 대기 게시글로 돌아가기",
        backUrl: `/admin/schools/${school.slug}/posts/pending`,
      });
    }

    res.render("admin/pending-post-detail", {
      admin: req.session.admin,
      school,
      post: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("승인 대기 게시글 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 게시글 승인
router.post("/admin/schools/:slug/posts/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    await pool.query(
      `
      UPDATE posts
      SET status = 'approved',
          approved_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND school_id = $2
      `,
      [id, school.id]
    );

    res.redirect(`/admin/schools/${school.slug}/posts/pending`);
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 승인 중 오류가 발생했습니다.");
  }
});

// 학교별 게시글 삭제
router.post("/admin/schools/:slug/posts/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    await pool.query(
      "DELETE FROM posts WHERE id = $1 AND school_id = $2",
      [id, school.id]
    );

    res.redirect(`/admin/schools/${school.slug}/posts/pending`);
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 삭제 중 오류가 발생했습니다.");
  }
});

// 학교별 공지사항 목록
router.get("/admin/schools/:slug/notices", requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT notices.*, schools.name AS school_name, schools.slug AS school_slug
      FROM notices
      JOIN schools ON notices.school_id = schools.id
      WHERE notices.school_id = $1
      ORDER BY notices.is_pinned DESC, notices.created_at DESC
      `,
      [school.id]
    );

    res.render("admin/notices", {
      admin: req.session.admin,
      school,
      notices: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항 목록을 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 공지사항 작성 페이지
router.get("/admin/schools/:slug/notices/new", requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    res.render("admin/notice-new", {
      admin: req.session.admin,
      school,
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항 작성 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 공지사항 작성 처리
router.post("/admin/schools/:slug/notices", requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content } = req.body;
    const isPinned = req.body.is_pinned === "on";

    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    if (!title || !content) {
      return res.render("admin/notice-new", {
        admin: req.session.admin,
        school,
        error: "제목과 내용을 모두 입력하세요.",
      });
    }

    await pool.query(
      `
      INSERT INTO notices (school_id, title, content, is_pinned)
      VALUES ($1, $2, $3, $4)
      `,
      [school.id, title, content, isPinned]
    );

    res.redirect(`/admin/schools/${school.slug}/notices`);
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항을 저장하는 중 오류가 발생했습니다.");
  }
});

// 학교별 공지사항 수정 페이지
router.get("/admin/schools/:slug/notices/:id/edit", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const noticeResult = await pool.query(
      "SELECT * FROM notices WHERE id = $1 AND school_id = $2",
      [id, school.id]
    );

    if (noticeResult.rows.length === 0) {
      return res.status(404).render("404", {
        title: "공지사항을 찾을 수 없습니다.",
        message: "존재하지 않는 공지사항입니다.",
        backLabel: "공지사항 관리로 돌아가기",
        backUrl: `/admin/schools/${school.slug}/notices`,
      });
    }

    res.render("admin/notice-edit", {
      admin: req.session.admin,
      school,
      notice: noticeResult.rows[0],
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항 수정 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 공지사항 수정 처리
router.post("/admin/schools/:slug/notices/:id/edit", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const { title, content } = req.body;
    const isPinned = req.body.is_pinned === "on";

    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const noticeResult = await pool.query(
      "SELECT * FROM notices WHERE id = $1 AND school_id = $2",
      [id, school.id]
    );

    if (noticeResult.rows.length === 0) {
      return res.status(404).render("404", {
        title: "공지사항을 찾을 수 없습니다.",
        message: "존재하지 않는 공지사항입니다.",
        backLabel: "공지사항 관리로 돌아가기",
        backUrl: `/admin/schools/${school.slug}/notices`,
      });
    }

    if (!title || !content) {
      return res.render("admin/notice-edit", {
        admin: req.session.admin,
        school,
        notice: noticeResult.rows[0],
        error: "제목과 내용을 모두 입력하세요.",
      });
    }

    await pool.query(
      `
      UPDATE notices
      SET title = $1,
          content = $2,
          is_pinned = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND school_id = $5
      `,
      [title, content, isPinned, id, school.id]
    );

    res.redirect(`/admin/schools/${school.slug}/notices`);
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항을 수정하는 중 오류가 발생했습니다.");
  }
});

// 학교별 공지사항 삭제
router.post("/admin/schools/:slug/notices/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    await pool.query(
      "DELETE FROM notices WHERE id = $1 AND school_id = $2",
      [id, school.id]
    );

    res.redirect(`/admin/schools/${school.slug}/notices`);
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

// 학교별 승인 대기 댓글 목록
router.get("/admin/schools/:slug/comments/pending", requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT
        comments.*,
        posts.title AS post_title,
        schools.name AS school_name,
        schools.slug AS school_slug
      FROM comments
      JOIN posts ON comments.post_id = posts.id
      JOIN schools ON comments.school_id = schools.id
      WHERE comments.school_id = $1
        AND comments.status = 'pending'
      ORDER BY comments.created_at DESC
      `,
      [school.id]
    );

    res.render("admin/pending-comments", {
      admin: req.session.admin,
      school,
      comments: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("승인 대기 댓글을 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 승인 대기 댓글 상세
router.get("/admin/schools/:slug/comments/pending/:id", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

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
        AND comments.school_id = $2
        AND comments.status = 'pending'
      `,
      [id, school.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).render("404", {
        title: "댓글을 찾을 수 없습니다.",
        message: "존재하지 않거나 이미 처리된 댓글입니다.",
        backLabel: "승인 대기 댓글로 돌아가기",
        backUrl: `/admin/schools/${school.slug}/comments/pending`,
      });
    }

    res.render("admin/comment-review", {
      admin: req.session.admin,
      school,
      item: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("댓글 검토 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 댓글 승인
router.post("/admin/schools/:slug/comments/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    await pool.query(
      `
      UPDATE comments
      SET status = 'approved',
          approved_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND school_id = $2
      `,
      [id, school.id]
    );

    res.redirect(`/admin/schools/${school.slug}/comments/pending`);
  } catch (error) {
    console.error(error);
    res.status(500).send("댓글 승인 중 오류가 발생했습니다.");
  }
});

// 학교별 댓글 삭제
router.post("/admin/schools/:slug/comments/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    await pool.query(
      "DELETE FROM comments WHERE id = $1 AND school_id = $2",
      [id, school.id]
    );

    res.redirect(`/admin/schools/${school.slug}/comments/pending`);
  } catch (error) {
    console.error(error);
    res.status(500).send("댓글 삭제 중 오류가 발생했습니다.");
  }
});

// 학교별 게시판 관리 목록
router.get("/admin/schools/:slug/board", requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const { q, status } = req.query;

    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const conditions = ["posts.school_id = $1"];
    const values = [school.id];

    let selectedStatus = "";
    let searchQuery = "";

    if (status && ["pending", "approved"].includes(status)) {
      values.push(status);
      conditions.push(`posts.status = $${values.length}`);
      selectedStatus = status;
    }

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

    const result = await pool.query(
      `
      SELECT
        posts.*,
        schools.name AS school_name,
        schools.slug AS school_slug,
        COUNT(comments.id) AS comment_count
      FROM posts
      JOIN schools ON posts.school_id = schools.id
      LEFT JOIN comments ON comments.post_id = posts.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY posts.id, schools.name, schools.slug
      ORDER BY posts.created_at DESC
      `,
      values
    );

    res.render("admin/board", {
      admin: req.session.admin,
      school,
      posts: result.rows,
      searchQuery,
      selectedStatus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 게시판을 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 관리자 게시글 상세
router.get("/admin/schools/:slug/board/posts/:id", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const postResult = await pool.query(
      `
      SELECT posts.*, schools.name AS school_name, schools.slug AS school_slug
      FROM posts
      JOIN schools ON posts.school_id = schools.id
      WHERE posts.id = $1 AND posts.school_id = $2
      `,
      [id, school.id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).render("404", {
        title: "게시글을 찾을 수 없습니다.",
        message: "존재하지 않는 게시글입니다.",
        backLabel: "게시판 관리로 돌아가기",
        backUrl: `/admin/schools/${school.slug}/board`,
      });
    }

    const commentsResult = await pool.query(
      `
      SELECT *
      FROM comments
      WHERE post_id = $1 AND school_id = $2
      ORDER BY created_at ASC
      `,
      [id, school.id]
    );

    res.render("admin/board-post-detail", {
      admin: req.session.admin,
      school,
      post: postResult.rows[0],
      comments: commentsResult.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 게시글 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 관리자 게시글 삭제
router.post("/admin/schools/:slug/board/posts/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    await pool.query(
      "DELETE FROM posts WHERE id = $1 AND school_id = $2",
      [id, school.id]
    );

    res.redirect(`/admin/schools/${school.slug}/board`);
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 삭제 중 오류가 발생했습니다.");
  }
});

// 학교별 관리자 댓글 삭제
router.post("/admin/schools/:slug/board/comments/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const commentResult = await pool.query(
      `
      SELECT comments.post_id
      FROM comments
      JOIN posts ON comments.post_id = posts.id
      WHERE comments.id = $1
        AND comments.school_id = $2
        AND posts.school_id = $2
      `,
      [id, school.id]
    );

    if (commentResult.rows.length === 0) {
      return res.redirect(`/admin/schools/${school.slug}/board`);
    }

    const postId = commentResult.rows[0].post_id;

    await pool.query(
      "DELETE FROM comments WHERE id = $1 AND school_id = $2",
      [id, school.id]
    );

    res.redirect(`/admin/schools/${school.slug}/board/posts/${postId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("댓글 삭제 중 오류가 발생했습니다.");
  }
});

// 학교별 승인 대기 분실물 목록
router.get("/admin/schools/:slug/lost-items/pending", requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT lost_items.*, schools.name AS school_name, schools.slug AS school_slug
      FROM lost_items
      JOIN schools ON lost_items.school_id = schools.id
      WHERE lost_items.school_id = $1
        AND lost_items.status = 'pending'
      ORDER BY lost_items.created_at DESC
      `,
      [school.id]
    );

    res.render("admin/pending-lost-items", {
      admin: req.session.admin,
      school,
      items: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("승인 대기 분실물을 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 승인 대기 분실물 상세
router.get("/admin/schools/:slug/lost-items/pending/:id", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT lost_items.*, schools.name AS school_name, schools.slug AS school_slug
      FROM lost_items
      JOIN schools ON lost_items.school_id = schools.id
      WHERE lost_items.id = $1
        AND lost_items.school_id = $2
        AND lost_items.status = 'pending'
      `,
      [id, school.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).render("404", {
        title: "분실물을 찾을 수 없습니다.",
        message: "존재하지 않거나 이미 처리된 분실물입니다.",
        backLabel: "승인 대기 분실물로 돌아가기",
        backUrl: `/admin/schools/${school.slug}/lost-items/pending`,
      });
    }

    res.render("admin/pending-lost-item-detail", {
      admin: req.session.admin,
      school,
      item: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("승인 대기 분실물 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 분실물 승인
router.post("/admin/schools/:slug/lost-items/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    await pool.query(
      `
      UPDATE lost_items
      SET status = 'approved',
          approved_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND school_id = $2
      `,
      [id, school.id]
    );

    res.redirect(`/admin/schools/${school.slug}/lost-items/pending`);
  } catch (error) {
    console.error(error);
    res.status(500).send("분실물 승인 중 오류가 발생했습니다.");
  }
});

// 학교별 분실물 관리 목록
router.get("/admin/schools/:slug/lost-items", requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const { q, status } = req.query;

    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const conditions = ["lost_items.school_id = $1"];
    const values = [school.id];

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

    const result = await pool.query(
      `
      SELECT lost_items.*, schools.name AS school_name, schools.slug AS school_slug
      FROM lost_items
      JOIN schools ON lost_items.school_id = schools.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY lost_items.created_at DESC
      `,
      values
    );

    res.render("admin/lost-items", {
      admin: req.session.admin,
      school,
      items: result.rows,
      searchQuery,
      selectedStatus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 분실물 목록을 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 관리자 분실물 상세
router.get("/admin/schools/:slug/lost-items/:id", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT lost_items.*, schools.name AS school_name, schools.slug AS school_slug
      FROM lost_items
      JOIN schools ON lost_items.school_id = schools.id
      WHERE lost_items.id = $1 AND lost_items.school_id = $2
      `,
      [id, school.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).render("404", {
        title: "분실물을 찾을 수 없습니다.",
        message: "존재하지 않는 분실물입니다.",
        backLabel: "분실물 관리로 돌아가기",
        backUrl: `/admin/schools/${school.slug}/lost-items`,
      });
    }

    res.render("admin/lost-item-detail", {
      admin: req.session.admin,
      school,
      item: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("관리자 분실물 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교별 분실물 삭제
router.post("/admin/schools/:slug/lost-items/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getAdminSchoolBySlug(slug);

    if (!school) {
      return renderAdminSchoolNotFound(res);
    }

    await pool.query(
      "DELETE FROM lost_items WHERE id = $1 AND school_id = $2",
      [id, school.id]
    );

    res.redirect(`/admin/schools/${school.slug}/lost-items`);
  } catch (error) {
    console.error(error);
    res.status(500).send("분실물 삭제 중 오류가 발생했습니다.");
  }
});

// 관리자 학교 관리 목록
router.get("/admin/schools", requireAdmin, async (req, res) => {
  try {
    const errorMessage = req.query.error || null;

    const result = await pool.query(`
      SELECT
        schools.*,
        (SELECT COUNT(*) FROM posts WHERE posts.school_id = schools.id) AS posts_count,
        (SELECT COUNT(*) FROM comments WHERE comments.school_id = schools.id) AS comments_count,
        (SELECT COUNT(*) FROM notices WHERE notices.school_id = schools.id) AS notices_count,
        (SELECT COUNT(*) FROM lost_items WHERE lost_items.school_id = schools.id) AS lost_items_count
      FROM schools
      ORDER BY schools.id ASC
    `);

    res.render("admin/schools", {
      pageTitle: "학교 관리 - SchoolHub",
      admin: req.session.admin,
      schools: result.rows,
      error: errorMessage,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("학교 목록을 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교 추가 페이지
router.get("/admin/schools/new", requireAdmin, (req, res) => {
  res.render("admin/school-new", {
    pageTitle: "학교 추가 - SchoolHub",
    admin: req.session.admin,
    error: null,
  });
});

// 학교 추가 처리
router.post("/admin/schools", requireAdmin, async (req, res) => {
  try {
    let { name, slug } = req.body;
    const isActive = req.body.is_active === "on";

    name = name?.trim();
    slug = slug?.trim().toLowerCase();

    if (!name || !slug) {
      return res.render("admin/school-new", {
        admin: req.session.admin,
        error: "학교 이름과 slug를 모두 입력하세요.",
      });
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.render("admin/school-new", {
        admin: req.session.admin,
        error: "slug는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.",
      });
    }

    await pool.query(
      `
      INSERT INTO schools (name, slug, is_active)
      VALUES ($1, $2, $3)
      `,
      [name, slug, isActive]
    );

    res.redirect("/admin/schools");
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.render("admin/school-new", {
        admin: req.session.admin,
        error: "이미 사용 중인 slug입니다.",
      });
    }

    res.status(500).send("학교를 추가하는 중 오류가 발생했습니다.");
  }
});

// 학교 수정 페이지
router.get("/admin/schools/:id/edit", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("SELECT * FROM schools WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).send("존재하지 않는 학교입니다.");
    }

    res.render("admin/school-edit", {
      pageTitle: "학교 수정 - SchoolHub",
      admin: req.session.admin,
      school: result.rows[0],
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("학교 수정 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 학교 수정 처리
router.post("/admin/schools/:id/edit", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let { name, slug } = req.body;
    const isActive = req.body.is_active === "on";

    name = name?.trim();
    slug = slug?.trim().toLowerCase();

    const schoolResult = await pool.query("SELECT * FROM schools WHERE id = $1", [id]);

    if (schoolResult.rows.length === 0) {
      return res.status(404).send("존재하지 않는 학교입니다.");
    }

    if (!name || !slug) {
      return res.render("admin/school-edit", {
        admin: req.session.admin,
        school: schoolResult.rows[0],
        error: "학교 이름과 slug를 모두 입력하세요.",
      });
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.render("admin/school-edit", {
        admin: req.session.admin,
        school: {
          ...schoolResult.rows[0],
          name,
          slug,
          is_active: isActive,
        },
        error: "slug는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.",
      });
    }

    await pool.query(
      `
      UPDATE schools
      SET name = $1,
          slug = $2,
          is_active = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
      [name, slug, isActive, id]
    );

    res.redirect("/admin/schools");
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      const { id } = req.params;
      const schoolResult = await pool.query("SELECT * FROM schools WHERE id = $1", [id]);

      return res.render("admin/school-edit", {
        admin: req.session.admin,
        school: schoolResult.rows[0],
        error: "이미 사용 중인 slug입니다.",
      });
    }

    res.status(500).send("학교를 수정하는 중 오류가 발생했습니다.");
  }
});

// 학교 활성화 / 비활성화
router.post("/admin/schools/:id/toggle", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE schools
      SET is_active = NOT is_active,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [id]
    );

    res.redirect("/admin/schools");
  } catch (error) {
    console.error(error);
    res.status(500).send("학교 상태를 변경하는 중 오류가 발생했습니다.");
  }
});

// 학교 삭제 처리 - 연결된 데이터가 없을 때만 가능
router.post("/admin/schools/:id/delete", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const countResult = await pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM posts WHERE school_id = $1) AS posts_count,
        (SELECT COUNT(*) FROM comments WHERE school_id = $1) AS comments_count,
        (SELECT COUNT(*) FROM notices WHERE school_id = $1) AS notices_count,
        (SELECT COUNT(*) FROM lost_items WHERE school_id = $1) AS lost_items_count
      `,
      [id]
    );

    const counts = countResult.rows[0];

    const total =
      Number(counts.posts_count) +
      Number(counts.comments_count) +
      Number(counts.notices_count) +
      Number(counts.lost_items_count);

    if (total > 0) {
      return res.redirect(
        "/admin/schools?error=" +
          encodeURIComponent(
            "게시글, 댓글, 공지, 분실물이 있는 학교는 삭제할 수 없습니다. 대신 비활성화를 사용하세요."
          )
      );
    }

    await pool.query("DELETE FROM schools WHERE id = $1", [id]);

    res.redirect("/admin/schools");
  } catch (error) {
    console.error(error);
    res.status(500).send("학교를 삭제하는 중 오류가 발생했습니다.");
  }
});

module.exports = router;