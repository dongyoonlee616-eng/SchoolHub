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

- 관리자 로그인
- 승인 대기 게시글 검토
- 승인 대기 댓글 검토
- 승인 대기 분실물 검토
- 게시글 승인 및 삭제
- 댓글 승인 및 삭제
- 분실물 승인 및 삭제
- 공지사항 작성, 수정, 삭제, 고정
- 건의사항 확인 및 삭제
- 전체 게시판 관리
- 전체 분실물 관리
- 관리자 전용 header/footer 제공

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
│  ├─ suggestions.js
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

## 환경변수

로컬 개발 시 프로젝트 최상위에 `.env` 파일이 필요합니다.

```env
PORT=*******
DB_HOST=*******
DB_PORT=*******
DB_NAME=*******
DB_USER=*******
DB_PASSWORD=*******
SESSION_SECRET=*******
```

Render 배포 시에는 Web Service의 Environment에 아래 환경변수를 등록합니다.

```env
NODE_ENV=*******
DATABASE_URL=*******
DB_SSL=*******
SESSION_SECRET=*******
ADMIN_PASSWORD=*******
```

## 설치 및 실행

패키지 설치:

```bash
npm install
```

로컬 개발 실행:

```bash
npm run dev
```

배포 환경 실행:

```bash
npm start
```

## package.json scripts

```json
{
  "scripts": {
    "start": "node setup-db.js && node server.js",
    "dev": "nodemon server.js"
  }
}
```

## DB 초기화

`setup-db.js`는 SchoolHub 실행에 필요한 DB 테이블을 자동으로 생성합니다.

```bash
node setup-db.js
```

Render 배포 환경에서는 `npm start` 실행 시 서버 시작 전에 DB 세팅이 먼저 실행됩니다.

```bash
node setup-db.js && node server.js
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

- `/`
  - 학교 선택 페이지
- `/schools/:slug`
  - 학교 커뮤니티 메인
- `/schools/:slug/posts`
  - 게시판
- `/schools/:slug/lost-items`
  - 분실물
- `/suggestions/new`
  - 건의사항 작성

### 관리자 페이지

관리자 페이지는 공개 화면에 링크를 노출하지 않고, 직접 주소로 접근합니다.

- `/admin/login`
  - 관리자 로그인
- `/admin`
  - 관리자 대시보드
- `/admin/posts/pending`
  - 승인 대기 게시글
- `/admin/comments/pending`
  - 승인 대기 댓글
- `/admin/lost-items/pending`
  - 승인 대기 분실물
- `/admin/notices`
  - 공지사항 관리
- `/admin/suggestions`
  - 건의사항 관리
- `/admin/board`
  - 전체 게시판 관리
- `/admin/lost-items`
  - 전체 분실물 관리

## 패치노트

해당 사이트의 버전 별 상세 변경 내용은 [PATCH_NOTES.md](PATCH_NOTES.md)를 참고해주세요.

## 알려진 사항

- 관리자 세션은 현재 기본 MemoryStore를 사용합니다.
- v1.0.0은 단일 학교 운영을 기준으로 구성되어 있습니다.
- 추후 여러 학교 확장, 관리자 계정 관리, 세션 저장소 개선 등을 진행할 수 있습니다.

## 버전

현재 버전: `v1.0.0`

## 개발자

Developed by DongYoon-Lee
