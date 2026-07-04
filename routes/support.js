const express = require("express");
const pool = require("../db");

const router = express.Router();

const SUPPORT_TYPES = {
  suggestion: "건의 사항",
  inquiry: "문의 사항",
  bug: "버그 제보",
  other: "기타 문의",
};

function isValidSupportType(type) {
  return Object.prototype.hasOwnProperty.call(SUPPORT_TYPES, type);
}

// 문의센터 페이지
router.get("/support", async (req, res) => {
  try {
    const selectedType = isValidSupportType(req.query.type)
      ? req.query.type
      : "";

    res.render("support", {
      school: null,
      supportTypes: SUPPORT_TYPES,
      selectedType,
      submitted: req.query.submitted === "1",
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("문의센터 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 문의 제출
router.post("/support", async (req, res) => {
  try {
    const { ticket_type, nickname, contact, title, content } = req.body;

    const ticketTypeValue = ticket_type?.trim();
    const titleValue = title?.trim();
    const contentValue = content?.trim();

    const nicknameValue =
      nickname && nickname.trim() ? nickname.trim() : "익명";

    const contactValue =
      contact && contact.trim() ? contact.trim() : null;

    if (!isValidSupportType(ticketTypeValue)) {
      return res.render("support", {
        school: null,
        supportTypes: SUPPORT_TYPES,
        selectedType: ticketTypeValue || "",
        submitted: false,
        error: "문의 유형을 올바르게 선택해주세요.",
      });
    }

    if (!titleValue || !contentValue) {
      return res.render("support", {
        school: null,
        supportTypes: SUPPORT_TYPES,
        selectedType: ticketTypeValue,
        submitted: false,
        error: "제목과 내용을 모두 입력해주세요.",
      });
    }

    await pool.query(
      `
      INSERT INTO support_tickets (
        ticket_type,
        nickname,
        contact,
        title,
        content,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      `,
      [
        ticketTypeValue,
        nicknameValue,
        contactValue,
        titleValue,
        contentValue,
      ]
    );

    res.redirect("/support?submitted=1");
  } catch (error) {
    console.error(error);
    res.status(500).send("문의를 저장하는 중 오류가 발생했습니다.");
  }
});

module.exports = router;