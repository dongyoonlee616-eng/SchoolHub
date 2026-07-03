const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM schools WHERE is_active = true ORDER BY id ASC"
    );
    res.render("index", { schools: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).send("학교 목록을 불러오는 중 오류가 발생했습니다.");
  }
});

router.get("/schools/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const schoolResult = await pool.query(
      "SELECT * FROM schools WHERE slug = $1 AND is_active = true",
      [slug]
    );

    if (schoolResult.rows.length === 0) {
      return res.status(404).send("존재하지 않는 학교입니다.");
    }

    const school = schoolResult.rows[0];

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

    const schoolResult = await pool.query(
      "SELECT * FROM schools WHERE slug = $1 AND is_active = true",
      [slug]
    );

    if (schoolResult.rows.length === 0) {
      return res.status(404).send("존재하지 않는 학교입니다.");
    }

    const school = schoolResult.rows[0];

    const noticeResult = await pool.query(
      `
      SELECT *
      FROM notices
      WHERE id = $1
      AND school_id = $2
      `,
      [id, school.id]
    );

    if (noticeResult.rows.length === 0) {
      return res.status(404).send("존재하지 않는 공지사항입니다.");
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