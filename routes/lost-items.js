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

// 분실물 목록
router.get("/schools/:slug/lost-items", async (req, res) => {
  try {
    const { slug } = req.params;
    const { q } = req.query;

    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const conditions = [
      "school_id = $1",
      "status = 'approved'",
    ];

    const values = [school.id];

    let searchQuery = "";

    if (q && q.trim().length > 0) {
      searchQuery = q.trim();
      values.push(`%${searchQuery}%`);

      conditions.push(`
        (
          title ILIKE $${values.length}
          OR content ILIKE $${values.length}
          OR found_place ILIKE $${values.length}
          OR pickup_place ILIKE $${values.length}
          OR nickname ILIKE $${values.length}
        )
      `);
    }

    const result = await pool.query(
      `
      SELECT *
      FROM lost_items
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      `,
      values
    );

    res.render("lost-items", {
      school,
      items: result.rows,
      searchQuery,
      submitted: req.query.submitted === "1",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("분실물 목록을 불러오는 중 오류가 발생했습니다.");
  }
});

// 분실물 등록 페이지
router.get("/schools/:slug/lost-items/new", async (req, res) => {
  try {
    const { slug } = req.params;
    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    res.render("lost-item-new", {
      school,
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("분실물 등록 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

// 분실물 등록 처리
router.post("/schools/:slug/lost-items", async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content, found_place, pickup_place, item_date, nickname, password } = req.body;

    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const titleValue = title?.trim();
    const contentValue = content?.trim();
    const foundPlaceValue = found_place?.trim();
    const pickupPlaceValue = pickup_place?.trim();
    const itemDateValue = item_date?.trim();
    const passwordValue = password?.trim();

    if (
    !titleValue ||
    !contentValue ||
    !foundPlaceValue ||
    !pickupPlaceValue ||
    !itemDateValue ||
    !passwordValue
    ) {
    return res.render("lost-item-new", {
        school,
        error: "닉네임을 제외한 모든 항목을 입력해야 합니다.",
    });
    }

    const displayNickname = nickname && nickname.trim() ? nickname.trim() : "익명";
    const passwordHash = await bcrypt.hash(passwordValue, 10);

    await pool.query(
        `
        INSERT INTO lost_items
        (
            school_id,
            title,
            content,
            found_place,
            pickup_place,
            item_date,
            nickname,
            password_hash,
            status,
            found_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'lost')
        `,
        [
            school.id,
            titleValue,
            contentValue,
            foundPlaceValue,
            pickupPlaceValue,
            itemDateValue,
            displayNickname,
            passwordHash,
        ]
    );

    res.redirect(`/schools/${school.slug}/lost-items?submitted=1`);
  } catch (error) {
    console.error(error);
    res.status(500).send("분실물을 저장하는 중 오류가 발생했습니다.");
  }
});

// 분실물 상세
router.get("/schools/:slug/lost-items/:id", async (req, res) => {
  try {
    const { slug, id } = req.params;

    const school = await getSchoolBySlug(slug);

    if (!school) {
      return renderSchoolNotFound(res);
    }

    const result = await pool.query(
      `
      SELECT *
      FROM lost_items
      WHERE id = $1
      AND school_id = $2
      AND status = 'approved'
      `,
      [id, school.id]
    );

    if (result.rows.length === 0) {
        return res.status(404).render("404", {
            school,
            title: "분실물을 찾을 수 없습니다.",
            message: "삭제되었거나, 존재하지 않는 분실물입니다.",
            backLabel: "분실물 목록으로 돌아가기",
            backUrl: `/schools/${school.slug}/lost-items`,
        });
    }

    res.render("lost-item-detail", {
      school,
      item: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("분실물 상세 페이지를 불러오는 중 오류가 발생했습니다.");
  }
});

module.exports = router;