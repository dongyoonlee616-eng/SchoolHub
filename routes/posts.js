const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const pool = require("../db");

async function getSchoolBySlug(slug) {
  const result = await pool.query(
    "SELECT * FROM schools WHERE slug = $1 AND is_active = true",
    [slug]
  );

  return result.rows[0];
}

function renderSchoolNotFound(res) {
  return res.status(404).render("404", {
    title: "학교를 찾을 수 없습니다.",
    message: "존재하지 않거나 현재 비활성화된 학교입니다.",
    backLabel: "메인 화면으로 돌아가기",
    backUrl: "/",
  });
}

// 게시글 목록
router.get("/schools/:slug/posts", async (req, res) => {
  try {
    const { slug } = req.params;
    const { category, q, searchType } = req.query;

    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const allowedCategories = ["자유", "질문", "건의"];

    const allowedSearchTypes = {
      title: "제목",
      content: "내용",
      nickname: "작성자",
    };

    const conditions = [
      "school_id = $1",
      "status = 'approved'",
    ];

    const values = [school.id];

    let selectedCategory = "";

    if (category && allowedCategories.includes(category)) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
      selectedCategory = category;
    }

    let searchQuery = "";
    let selectedSearchType = "title";

    if (searchType && allowedSearchTypes[searchType]) {
      selectedSearchType = searchType;
    }

    if (q && q.trim().length > 0) {
      searchQuery = q.trim();
      values.push(`%${searchQuery}%`);

      conditions.push(`${selectedSearchType} ILIKE $${values.length}`);
    }

    const result = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      `,
      values
    );

    res.render("posts", {
      school,
      posts: result.rows,
      categories: allowedCategories,
      selectedCategory,
      searchQuery,
      selectedSearchType,
      submitted: req.query.submitted === "1",
      edited: req.query.edited === "1",
      deleted: req.query.deleted === "1",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 목록을 불러오는 중 오류가 발생했습니다.");
  }
});

// 게시글 작성 페이지
router.get("/schools/:slug/posts/new", async (req, res) => {
  try {
    const { slug } = req.params;
    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    res.render("post-new", { school });
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 작성 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 게시판 이용 안내 상세 페이지
router.get("/schools/:slug/posts/guide", async (req, res) => {
  try {
    const { slug } = req.params;
    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    res.render("board-guide", { school });
  } catch (error) {
    console.error(error);
    res.status(500).send("게시판 이용 안내 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 게시글 상세 페이지
router.get("/schools/:slug/posts/:id", async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const postResult = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE id = $1
      AND school_id = $2
      AND status = 'approved'
      `,
      [id, school.id]
    );

    if (postResult.rows.length === 0) {
        return res.status(404).render("404", {
            school,
            title: "게시글을 찾을 수 없습니다.",
            message: "삭제되었거나, 승인되지 않았거나, 존재하지 않는 게시글입니다.",
            backLabel: "게시판으로 돌아가기",
            backUrl: `/schools/${school.slug}/posts`,
        });
    }

    const commentsResult = await pool.query(
      `
      SELECT *
      FROM comments
      WHERE post_id = $1
      AND school_id = $2
      AND status = 'approved'
      ORDER BY created_at ASC
      `,
      [id, school.id]
    );

    res.render("post-detail", {
      school,
      post: postResult.rows[0],
      comments: commentsResult.rows,
      commentSubmitted: req.query.commentSubmitted === "1",
      reportSubmitted: req.query.reportSubmitted === "1",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 게시글 신고 페이지
router.get("/schools/:slug/posts/:id/report", async (req, res) => {
  try {
    const { slug, id } = req.params;

    const school = await getSchoolBySlug(slug);

    if (!school) {
      return res.status(404).send("존재하지 않는 학교입니다.");
    }

    const postResult = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE id = $1
        AND school_id = $2
        AND status = 'approved'
      `,
      [id, school.id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).render("404", {
        school,
        title: "게시글을 찾을 수 없습니다.",
        message: "삭제되었거나, 승인되지 않았거나, 존재하지 않는 게시글입니다.",
        backLabel: "게시판으로 돌아가기",
        backUrl: `/schools/${school.slug}/posts`,
      });
    }

    res.render("post-report", {
      school,
      post: postResult.rows[0],
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("신고 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 게시글 신고 처리
router.post("/schools/:slug/posts/:id/report", async (req, res) => {
  try {
    const { slug, id } = req.params;
    const { reporter_nickname, reason, content } = req.body;

    const allowedReasons = [
      "욕설/비방",
      "개인정보 노출",
      "허위사실",
      "도배/스팸",
      "기타",
    ];

    const school = await getSchoolBySlug(slug);

    if (!school) {
      return res.status(404).send("존재하지 않는 학교입니다.");
    }

    const postResult = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE id = $1
        AND school_id = $2
        AND status = 'approved'
      `,
      [id, school.id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).render("404", {
        school,
        title: "게시글을 찾을 수 없습니다.",
        message: "삭제되었거나, 승인되지 않았거나, 존재하지 않는 게시글입니다.",
        backLabel: "게시판으로 돌아가기",
        backUrl: `/schools/${school.slug}/posts`,
      });
    }

    const post = postResult.rows[0];

    const reporterNicknameValue =
      reporter_nickname && reporter_nickname.trim()
        ? reporter_nickname.trim()
        : "익명";

    const reasonValue = reason?.trim();
    const contentValue = content?.trim();

    if (!reasonValue || !contentValue) {
      return res.render("post-report", {
        school,
        post,
        error: "신고 사유와 상세 내용을 입력해주세요.",
      });
    }

    if (!allowedReasons.includes(reasonValue)) {
      return res.render("post-report", {
        school,
        post,
        error: "올바르지 않은 신고 사유입니다.",
      });
    }

    await pool.query(
      `
      INSERT INTO post_reports (
        school_id,
        post_id,
        reporter_nickname,
        reason,
        content,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      `,
      [
        school.id,
        post.id,
        reporterNicknameValue,
        reasonValue,
        contentValue,
      ]
    );

    res.redirect(`/schools/${school.slug}/posts/${post.id}?reportSubmitted=1`);
  } catch (error) {
    console.error(error);
    res.status(500).send("신고를 저장하는 중 오류가 발생했습니다.");
  }
});

// 댓글 작성 처리
router.post("/schools/:slug/posts/:id/comments", async (req, res) => {
  try {
    const { slug, id } = req.params;
    const { nickname, content } = req.body;

    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const postResult = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE id = $1
      AND school_id = $2
      AND status = 'approved'
      `,
      [id, school.id]
    );

    if (postResult.rows.length === 0) {
        return res.status(404).render("404", {
            school,
            title: "게시글을 찾을 수 없습니다.",
            message: "삭제되었거나, 승인되지 않았거나, 존재하지 않는 게시글입니다.",
            backLabel: "게시판으로 돌아가기",
            backUrl: `/schools/${school.slug}/posts`,
        });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).send("댓글 내용을 입력해주세요.");
    }

    const displayNickname = nickname && nickname.trim() ? nickname.trim() : "익명";

    await pool.query(
      `
      INSERT INTO comments
      (post_id, school_id, content, nickname, status)
      VALUES ($1, $2, $3, $4, 'pending')
      `,
      [id, school.id, content.trim(), displayNickname]
    );

    res.redirect(`/schools/${school.slug}/posts/${id}?commentSubmitted=1`);
  } catch (error) {
    console.error(error);
    res.status(500).send("댓글을 저장하는 중 오류가 발생했습니다.");
  }
});

// 게시글 수정 페이지
router.get("/schools/:slug/posts/:id/edit", async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE id = $1
      AND school_id = $2
      AND status = 'approved'
      `,
      [id, school.id]
    );

    if (postResult.rows.length === 0) {
        return res.status(404).render("404", {
            school,
            title: "게시글을 찾을 수 없습니다.",
            message: "삭제되었거나, 승인되지 않았거나, 존재하지 않는 게시글입니다.",
            backLabel: "게시판으로 돌아가기",
            backUrl: `/schools/${school.slug}/posts`,
        });
    }

    res.render("post-edit", {
      school,
      post: result.rows[0],
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 수정 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 게시글 수정 처리
router.post("/schools/:slug/posts/:id/edit", async (req, res) => {
  try {
    const { slug, id } = req.params;
    const { category, title, content, password } = req.body;

    const allowedCategories = ["자유", "질문", "건의"];

    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE id = $1
      AND school_id = $2
      AND status = 'approved'
      `,
      [id, school.id]
    );

    if (postResult.rows.length === 0) {
        return res.status(404).render("404", {
            school,
            title: "게시글을 찾을 수 없습니다.",
            message: "삭제되었거나, 승인되지 않았거나, 존재하지 않는 게시글입니다.",
            backLabel: "게시판으로 돌아가기",
            backUrl: `/schools/${school.slug}/posts`,
        });
    }

    const post = result.rows[0];

    if (!category || !title || !content || !password) {
        return res.render("post-edit", {
            school,
            post,
            error: "모든 항목을 입력해주세요.",
        });
    }

    if (!allowedCategories.includes(category)) {
        return res.render("post-edit", {
            school,
            post,
            error: "올바르지 않은 카테고리입니다.",
        });
    }

    const isMatch = await bcrypt.compare(password, post.password_hash);

    if (!isMatch) {
      return res.render("post-edit", {
        school,
        post,
        error: "글 비밀번호가 올바르지 않습니다.",
      });
    }

    await pool.query(
      `
      UPDATE posts
      SET category = $1,
          title = $2,
          content = $3,
          status = 'pending',
          approved_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
      [category, title, content, id]
    );

    res.redirect(`/schools/${school.slug}/posts?edited=1`);
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글을 수정하는 중 오류가 발생했습니다.");
  }
});

// 게시글 삭제 페이지
router.get("/schools/:slug/posts/:id/delete", async (req, res) => {
  try {
    const { slug, id } = req.params;
    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE id = $1
      AND school_id = $2
      AND status = 'approved'
      `,
      [id, school.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).render("404", {
            school,
            title: "게시글을 찾을 수 없습니다.",
            message: "삭제되었거나, 승인되지 않았거나, 존재하지 않는 게시글입니다.",
            backLabel: "게시판으로 돌아가기",
            backUrl: `/schools/${school.slug}/posts`,
        });
    }

    res.render("post-delete", {
      school,
      post: result.rows[0],
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글 삭제 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 게시글 삭제 처리
router.post("/schools/:slug/posts/:id/delete", async (req, res) => {
  try {
    const { slug, id } = req.params;
    const { password } = req.body;

    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE id = $1
      AND school_id = $2
      AND status = 'approved'
      `,
      [id, school.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).render("404", {
            school,
            title: "게시글을 찾을 수 없습니다.",
            message: "삭제되었거나, 승인되지 않았거나, 존재하지 않는 게시글입니다.",
            backLabel: "게시판으로 돌아가기",
            backUrl: `/schools/${school.slug}/posts`,
        });
    }

    const post = result.rows[0];

    if (!password) {
      return res.render("post-delete", {
        school,
        post,
        error: "글 비밀번호를 입력해주세요.",
      });
    }

    const isMatch = await bcrypt.compare(password, post.password_hash);

    if (!isMatch) {
      return res.render("post-delete", {
        school,
        post,
        error: "글 비밀번호가 올바르지 않습니다.",
      });
    }

    await pool.query(
      "DELETE FROM posts WHERE id = $1",
      [id]
    );

    res.redirect(`/schools/${school.slug}/posts?deleted=1`);
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글을 삭제하는 중 오류가 발생했습니다.");
  }
});

// 게시글 작성 처리
router.post("/schools/:slug/posts", async (req, res) => {
  try {
    const { slug } = req.params;
    const { category, title, content, nickname, password } = req.body;

    const allowedCategories = ["자유", "질문", "건의"];

    const school = await getSchoolBySlug(slug);

    if (!school) {
        return renderSchoolNotFound(res);
    }

    if (!category || !title || !content || !password) {
        return res.status(400).send("카테고리, 제목, 내용, 글 비밀번호를 입력해야 합니다.");
    }

    if (!allowedCategories.includes(category)) {
        return res.status(400).send("올바르지 않은 카테고리입니다.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const displayNickname = nickname && nickname.trim() ? nickname.trim() : "익명";

    await pool.query(
      `
      INSERT INTO posts
      (school_id, category, title, content, nickname, password_hash, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      `,
      [school.id, category, title, content, displayNickname, passwordHash]
    );

    res.redirect(`/schools/${school.slug}/posts?submitted=1`);
  } catch (error) {
    console.error(error);
    res.status(500).send("게시글을 저장하는 중 오류가 발생했습니다.");
  }
});

module.exports = router;