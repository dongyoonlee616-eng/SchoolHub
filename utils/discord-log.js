function truncateText(value, maxLength = 900) {
  if (value === null || value === undefined || value === "") return "-";

  const text = String(value);

  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength)}...`;
}

function getKoreanTime() {
  return new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (forwardedFor) {
    return String(forwardedFor).split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "-";
}

function getActor(req) {
  const user = req.session && req.session.user ? req.session.user : null;

  if (!user) {
    return "비로그인 사용자";
  }

  return [
    `닉네임: ${user.nickname || "-"}`,
    `이메일: ${user.email || "-"}`,
    `권한: ${user.role || "-"}`,
    `ID: ${user.id || "-"}`,
  ].join("\n");
}

const WEBHOOK_MAP = {
  account: process.env.DISCORD_WEBHOOK_ACCOUNT,
  approval: process.env.DISCORD_WEBHOOK_APPROVAL,
  reject: process.env.DISCORD_WEBHOOK_REJECT,
  delete: process.env.DISCORD_WEBHOOK_DELETE,
  etc: process.env.DISCORD_WEBHOOK_ETC,
};

const COLOR_MAP = {
  account: 0x3b82f6,
  approval: 0x22c55e,
  reject: 0xef4444,
  delete: 0xdc2626,
  etc: 0x8b5cf6,
};

const NAME_MAP = {
  account: "SchoolHub Account Log",
  approval: "SchoolHub Approval Log",
  reject: "SchoolHub Reject Log",
  delete: "SchoolHub Delete Log",
  etc: "SchoolHub Etc Log",
};

function getWebhookUrl(category) {
  return WEBHOOK_MAP[category] || null;
}

async function sendDiscordLog(category, { title, description, fields = [], color = null }) {
  const webhookUrl = getWebhookUrl(category);

  if (!webhookUrl) {
    return;
  }

  const payload = {
    username: NAME_MAP[category] || "SchoolHub Log",
    embeds: [
      {
        title: truncateText(title, 250),
        description: truncateText(description, 1800),
        color: color || COLOR_MAP[category] || 0x3b82f6,
        fields: fields.map((field) => ({
          name: truncateText(field.name, 200),
          value: truncateText(field.value, 900),
          inline: Boolean(field.inline),
        })),
        footer: {
          text: `SchoolHub · ${getKoreanTime()}`,
        },
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        "Discord 로그 전송 실패:",
        category,
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    console.error("Discord 로그 전송 오류:", category, error);
  }
}

function logSchoolHub(category, req, { action, school = null, target = null, detail = null, fields = [] }) {
  return sendDiscordLog(category, {
    title: `${action}`,
    description: detail || "SchoolHub 로그가 기록되었습니다.",
    fields: [
      {
        name: "실행자",
        value: getActor(req),
      },
      {
        name: "IP",
        value: getClientIp(req),
        inline: true,
      },
      {
        name: "요청",
        value: `${req.method} ${req.originalUrl}`,
        inline: true,
      },
      {
        name: "학교",
        value: school ? `${school.name} / ${school.slug}` : "-",
        inline: true,
      },
      {
        name: "대상",
        value: target || "-",
        inline: true,
      },
      ...fields,
    ],
  });
}

function logAccount(req, data) {
  return logSchoolHub("account", req, data);
}

function logApproval(req, data) {
  return logSchoolHub("approval", req, data);
}

function logReject(req, data) {
  return logSchoolHub("reject", req, data);
}

function logDelete(req, data) {
  return logSchoolHub("delete", req, data);
}

function logEtc(req, data) {
  return logSchoolHub("etc", req, data);
}

module.exports = {
  logAccount,
  logApproval,
  logReject,
  logDelete,
  logEtc,
};