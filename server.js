const express = require("express");
const session = require("express-session");
const path = require("path");
require("dotenv").config();

const schoolRoutes = require("./routes/schools");
const postRoutes = require("./routes/posts");
const adminRoutes = require("./routes/admin");
const suggestionRoutes = require("./routes/suggestions");
const lostItemRoutes = require("./routes/lost-items");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use("/", schoolRoutes);
app.use("/", postRoutes);
app.use("/", adminRoutes);
app.use("/", suggestionRoutes);
app.use("/", lostItemRoutes);

app.use((req, res) => {
  res.status(404).render("404", {
    school: null,
    title: "페이지를 찾을 수 없습니다.",
    message: "주소가 잘못되었거나 삭제된 페이지입니다.",
    backLabel: "메인 화면으로 돌아가기",
    backUrl: "/",
  });
});

const PORT = process.env.PORT || 3000;

const pool = require("./db");

pool.query("SELECT NOW()")
    .then(() => {
        console.log("✅ PostgreSQL 연결 성공");
    })
    .catch(err => {
        console.error("❌ DB 연결 실패");
        console.error(err);
    });

app.listen(PORT, () => {
  console.log(`SchoolHub server running on http://localhost:${PORT}`);
});