const express = require("express");
const router = express.Router();
const pool = require("../db");

// 건의사항 작성 페이지
router.get("/suggestions/new", (req, res) => {
  res.render("suggestion-new", {
    submitted: req.query.submitted === "1",
    error: null,
  });
});

// 건의사항 작성 처리
router.post("/suggestions", async (req, res) => {
  try {
    const { nickname, content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.render("suggestion-new", {
        submitted: false,
        error: "건의 내용을 입력해주세요.",
      });
    }

    await pool.query(
      `
      INSERT INTO suggestions (nickname, content)
      VALUES ($1, $2)
      `,
      [nickname || "익명", content]
    );

    res.redirect("/suggestions/new?submitted=1");
  } catch (error) {
    console.error(error);
    res.status(500).send("건의사항을 저장하는 중 오류가 발생했습니다.");
  }
});

module.exports = router;