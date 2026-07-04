# SchoolHub

SchoolHub는 학교별 커뮤니티를 운영할 수 있는 웹 플랫폼입니다.  
현재 v1.0.0에서는 근명중학교 커뮤니티를 기준으로 게시판, 댓글, 공지사항, 건의사항, 분실물 기능을 제공합니다.

## 배포 주소

https://schoolhub-n2v3.onrender.com

## 주요 기능

### 사용자 기능

- 학교 선택
- 학교 커뮤니티 메인
- 게시판 목록 조회
- 게시글 작성
- 게시글 수정 및 삭제
- 댓글 작성
- 공지사항 확인
- 건의사항 제출
- 분실물 등록 및 확인
- 삭제되었거나 존재하지 않는 페이지 접근 시 404 페이지 표시

### 관리자 기능

- 페이지 전체 관리 기능

보안상의 이유로 자세히 공개되지 않습니다.

## 기술 스택

- Node.js
- Express
- EJS
- PostgreSQL
- bcrypt
- express-session
- Render

## 프로젝트 구조

```txt
SchoolHub/
├─ public/
│  ├─ css/
│  └─ js/
├─ routes/
│  ├─ admin.js
│  ├─ schools.js
│  ├─ posts.js
│  ├─ support.js
│  └─ lost-items.js
├─ views/
│  ├─ admin/
│  ├─ partials/
│  ├─ 404.ejs
│  └─ ...
├─ db.js
├─ server.js
├─ setup-db.js
├─ create-admin.js
├─ package.json
├─ README.md
└─ PATCH_NOTES.md
```

## v1.0.0 기준 DB 테이블

- schools
- posts
- comments
- admins
- notices
- suggestions
- lost_items

## 주요 페이지

### 사용자 페이지

- 학교 선택 페이지
- 학교 메인 페이지
- 게시판
  - 게시판 작성 페이지
  - 게시판 상세 페이지
- 분실물
  - 분실물 작성 페이지
  - 분실물 상세 페이지
- 공지사항 페이지
- 문의센터

### 관리자 페이지

관리자 페이지는 보안상의 문제로 정보를 공개하지 않습니다.

## 패치노트

해당 사이트의 버전 별 상세 변경 내용은 [PATCH_NOTES.md](PATCH_NOTES.md)를 참고해주세요.

## 버전

현재 버전: `v1.2.0`

## 개발자

Developed by DongYoon-Lee
