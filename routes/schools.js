const express = require("express");
const router = express.Router();
const pool = require("../db");

function renderSchoolNotFound(res) {
  return res.status(404).render("404", {
    title: "학교를 찾을 수 없습니다.",
    message: "존재하지 않거나 현재 비활성화된 학교입니다.",
    backLabel: "메인 화면으로 돌아가기",
    backUrl: "/",
  });
}

async function getActiveSchoolBySlug(slug) {
  const result = await pool.query(
    "SELECT * FROM schools WHERE slug = $1 AND is_active = true",
    [slug]
  );

  return result.rows[0];
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
        `
        SELECT *
        FROM schools
        WHERE is_active = true
        ORDER BY name ASC, id ASC
        `
    );

    res.render("index", {
      schools: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("학교 목록을 불러오는 중 오류가 발생했습니다.");
  }
});

router.get("/schools/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const school = await getActiveSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const noticeResult = await pool.query(
      `
      SELECT *
      FROM notices
      WHERE school_id = $1
      ORDER BY is_pinned DESC, created_at DESC
      `,
      [school.id]
    );

    res.render("school", {
      school,
      notices: noticeResult.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("학교 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

router.get("/schools/:slug/notices/:id", async (req, res) => {
  try {
    const { slug, id } = req.params;

    const school = await getActiveSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const noticeResult = await pool.query(
      `
      SELECT *
      FROM notices
      WHERE id = $1 AND school_id = $2
      `,
      [id, school.id]
    );

    if (noticeResult.rows.length === 0) {
      return res.status(404).render("404", {
        school,
        title: "공지사항을 찾을 수 없습니다.",
        message: "삭제되었거나 존재하지 않는 공지사항입니다.",
        backLabel: "학교 메인으로 돌아가기",
        backUrl: `/schools/${school.slug}`,
      });
    }

    res.render("notice-detail", {
      school,
      notice: noticeResult.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("공지사항 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

module.exports = router;