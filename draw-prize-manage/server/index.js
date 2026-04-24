const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "store.json");
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

async function readStore() {
  const raw = await fsp.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeStore(store) {
  await fsp.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  res.end(payload);
}

function notFound(res, message = "Not Found") {
  sendJson(res, 404, { error: message });
}

function badRequest(res, message) {
  sendJson(res, 400, { error: message });
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("JSON 格式无效"));
      }
    });
    req.on("error", reject);
  });
}

function formatDate(dateLike) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(new Date(dateLike))
    .replace(/\//g, "-");
}

function enrichActivity(activity, store) {
  const entries = store.entries.filter((entry) => entry.activityId === activity.id);
  const winners = entries.filter((entry) => entry.isWinner);
  return {
    ...activity,
    participantCount: activity.participantCount || new Set(entries.map((entry) => entry.userId)).size,
    entryCount: activity.entryCount || entries.length,
    winnerCount: winners.length
  };
}

function getPrizeLabel(prize) {
  if (!prize) {
    return "谢谢参与";
  }
  if (prize.level >= 99) {
    return prize.name;
  }
  return `${toChineseRank(prize.level)}：${prize.name}`;
}

function toChineseRank(level) {
  const labels = {
    1: "一等奖",
    2: "二等奖",
    3: "三等奖",
    4: "四等奖",
    5: "五等奖"
  };
  return labels[level] || `${level}等奖`;
}

function buildDashboard(store) {
  const activities = store.activities.map((activity) => enrichActivity(activity, store));
  const entries = store.entries;
  return {
    activeActivities: activities.filter((activity) => activity.status === "进行中").length,
    totalParticipants: new Set(entries.map((entry) => entry.userId)).size,
    totalEntries: entries.length,
    pendingDrawActivities: activities.filter((activity) => activity.status === "待开奖").length,
    activities
  };
}

function buildStatistics(store) {
  const prizeStats = store.prizes
    .filter((prize) => prize.activityId === 1001)
    .map((prize) => ({
      label: prize.level >= 99 ? prize.name : getPrizeLabel(prize),
      value: store.entries.filter((entry) => entry.prizeId === prize.id).length
    }));

  const trendMap = new Map();
  for (const entry of store.entries.filter((item) => item.activityId === 1001)) {
    const day = formatDate(entry.obtainedAt).slice(5, 10);
    trendMap.set(day, (trendMap.get(day) || 0) + 1);
  }

  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return { prizeStats, trend };
}

function findActivity(store, activityId) {
  return store.activities.find((activity) => activity.id === activityId);
}

function buildActivityDetail(store, activity) {
  const prizes = store.prizes.filter((prize) => prize.activityId === activity.id);
  const entries = store.entries.filter((entry) => entry.activityId === activity.id);
  const recentEntries = entries
    .slice()
    .sort((a, b) => new Date(b.obtainedAt) - new Date(a.obtainedAt))
    .slice(0, 5)
    .map((entry) => ({
      ...entry,
      obtainedAtLabel: formatDate(entry.obtainedAt)
    }));

  return {
    ...enrichActivity(activity, store),
    prizes,
    recentEntries,
    stats: {
      prizeCount: prizes.length,
      waitingEntries: entries.filter((entry) => entry.status === "待开奖").length,
      awardedEntries: entries.filter((entry) => entry.isWinner).length
    }
  };
}

function getUserEntries(store, activityId, userId) {
  return store.entries.filter((entry) => entry.activityId === activityId && entry.userId === userId);
}

function normalizeUserId(userId) {
  return String(userId || "23506");
}

function getJoinLimitNumber(joinLimit) {
  if (joinLimit === "总共1次") return 1;
  if (joinLimit === "总共3次") return 3;
  return null;
}

function generateEntryCode(store) {
  let code = "";
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (store.entries.some((entry) => entry.code === code));
  return code;
}

function findEntry(store, entryId) {
  return store.entries.find((entry) => entry.id === entryId);
}

function buildRecordStatus(entry) {
  if (!entry.isWinner) {
    return "未中奖";
  }
  return entry.redeemStatus || "待兑奖";
}

function buildUserRecord(entry, activity) {
  return {
    entryId: entry.id,
    activityId: entry.activityId,
    activityName: activity ? activity.name : `活动${entry.activityId}`,
    code: entry.code,
    prizeName: entry.prizeName || "谢谢参与",
    status: buildRecordStatus(entry),
    isWinner: entry.isWinner,
    obtainedAt: entry.obtainedAt,
    obtainedAtLabel: formatDate(entry.obtainedAt),
    redeemDeadline: entry.redeemDeadline || "",
    redeemDeadlineLabel: entry.redeemDeadline ? formatDate(entry.redeemDeadline) : "",
    recipientName: entry.recipientName || "",
    phone: entry.phone || "",
    address: entry.address || "",
    shippingStatus: entry.shippingStatus || "",
    trackingNo: entry.trackingNo || ""
  };
}

function formatInputDate(dateLike) {
  if (!dateLike) {
    return "-";
  }
  const date = new Date(dateLike);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

function getUserActivityView(store, activity, userId) {
  const normalizedUserId = normalizeUserId(userId);
  const prizes = store.prizes
    .filter((prize) => prize.activityId === activity.id)
    .sort((a, b) => a.level - b.level);
  const userEntries = getUserEntries(store, activity.id, normalizedUserId).sort(
    (a, b) => new Date(a.obtainedAt) - new Date(b.obtainedAt)
  );
  const winnerEntries = userEntries.filter((entry) => entry.isWinner);
  const pendingEntries = userEntries.filter((entry) => entry.status === "待开奖");
  const endedEntries = userEntries.filter((entry) => entry.status === "已开奖" && !entry.isWinner);

  let userStatus = "未参与";
  let detailPage = "m-activity-detail.html";
  if (winnerEntries.length > 0) {
    userStatus = "已中奖";
  } else if (pendingEntries.length > 0) {
    userStatus = "待开奖";
  } else if (endedEntries.length > 0) {
    userStatus = "未中奖";
  }

  const highlightEntry = winnerEntries[0] || pendingEntries[0] || userEntries[0] || null;
  const ctaText =
    userStatus === "已中奖"
      ? "去兑奖"
      : userStatus === "待开奖"
        ? "再领一个抽奖码"
        : userStatus === "未中奖"
          ? "查看结果"
          : activity.buttonText || "立即参与抽奖";

  return {
    id: activity.id,
    name: activity.name,
    subtitle: activity.subtitle || "",
    description: activity.description || "",
    buttonText: activity.buttonText || "立即参与抽奖",
    drawTime: activity.drawTime,
    drawTimeLabel: formatDate(activity.drawTime),
    startTime: activity.startTime,
    endTime: activity.endTime,
    status: activity.status,
    joinLimit: activity.joinLimit || "每天1次",
    participantCount: enrichActivity(activity, store).participantCount,
    entryCount: enrichActivity(activity, store).entryCount,
    tasks: activity.tasks || [],
    prizes: prizes.map((prize) => ({
      id: prize.id,
      level: prize.level,
      name: prize.name,
      quantity: prize.quantity,
      type: prize.type,
      label: getPrizeLabel(prize)
    })),
    userStatus,
    userEntryCount: userEntries.length,
    userEntries: userEntries.map((entry) => ({
      id: entry.id,
      code: entry.code,
      source: entry.source,
      status: entry.status,
      prizeName: entry.prizeName,
      obtainedAt: entry.obtainedAt,
      obtainedAtLabel: formatDate(entry.obtainedAt)
    })),
    latestCode: highlightEntry ? highlightEntry.code : "",
    latestPrizeName: highlightEntry ? highlightEntry.prizeName || "谢谢参与" : "",
    ctaText,
    detailUrl: `${detailPage}?id=${activity.id}&userId=${encodeURIComponent(normalizedUserId)}`,
    metrics: {
      participants: enrichActivity(activity, store).participantCount,
      totalEntries: enrichActivity(activity, store).entryCount,
      userEntries: userEntries.length
    },
    summary: {
      drawTime: formatInputDate(activity.drawTime),
      statusLabel:
        userStatus === "未参与"
          ? "可参与"
          : userStatus === "待开奖"
            ? "进行中"
            : userStatus === "已中奖"
              ? "待兑奖"
              : "已结束"
    }
  };
}

async function handleApi(req, res, url) {
  const store = await readStore();
  const pathname = url.pathname;
  const method = req.method;

  if (pathname === "/api/health" && method === "GET") {
    return sendJson(res, 200, { ok: true, time: new Date().toISOString() });
  }

  if (pathname === "/api/state" && method === "GET") {
    return sendJson(res, 200, {
      dashboard: buildDashboard(store),
      activities: store.activities.map((activity) => enrichActivity(activity, store)),
      prizes: store.prizes,
      entries: store.entries,
      winners: store.entries.filter((entry) => entry.isWinner),
      logs: store.interventionLogs,
      statistics: buildStatistics(store)
    });
  }

  if (pathname === "/api/dashboard" && method === "GET") {
    return sendJson(res, 200, buildDashboard(store));
  }

  if (pathname === "/api/activities" && method === "GET") {
    return sendJson(res, 200, store.activities.map((activity) => enrichActivity(activity, store)));
  }

  if (pathname === "/api/mobile/activities" && method === "GET") {
    const userId = normalizeUserId(url.searchParams.get("userId"));
    const activities = store.activities
      .slice()
      .sort((a, b) => new Date(b.drawTime) - new Date(a.drawTime))
      .map((activity) => getUserActivityView(store, activity, userId));
    return sendJson(res, 200, {
      userId,
      summary: {
        totalActivities: activities.length,
        totalUserEntries: activities.reduce((sum, item) => sum + item.userEntryCount, 0),
        wonActivities: activities.filter((item) => item.userStatus === "已中奖").length
      },
      activities
    });
  }

  const mobileActivityMatch = pathname.match(/^\/api\/mobile\/activities\/(\d+)$/);
  if (mobileActivityMatch && method === "GET") {
    const activityId = Number(mobileActivityMatch[1]);
    const userId = normalizeUserId(url.searchParams.get("userId"));
    const activity = findActivity(store, activityId);
    if (!activity) {
      return notFound(res, "活动不存在");
    }
    return sendJson(res, 200, getUserActivityView(store, activity, userId));
  }

  if (pathname === "/api/mobile/records" && method === "GET") {
    const userId = normalizeUserId(url.searchParams.get("userId"));
    const records = store.entries
      .filter((entry) => entry.userId === userId)
      .filter((entry) => entry.isWinner || entry.status === "已开奖" || entry.status === "已中奖")
      .sort((a, b) => new Date(b.obtainedAt) - new Date(a.obtainedAt))
      .map((entry) => buildUserRecord(entry, findActivity(store, entry.activityId)));

    return sendJson(res, 200, {
      userId,
      summary: {
        totalWins: records.filter((item) => item.isWinner).length,
        pendingRedeem: records.filter((item) => item.status === "待兑奖").length,
        delivered: records.filter((item) => item.status === "已发放" || item.status === "已签收").length
      },
      records
    });
  }

  const mobileRedeemMatch = pathname.match(/^\/api\/mobile\/redeem\/(\d+)$/);
  if (mobileRedeemMatch && method === "GET") {
    const entryId = Number(mobileRedeemMatch[1]);
    const userId = normalizeUserId(url.searchParams.get("userId"));
    const entry = findEntry(store, entryId);
    if (!entry || entry.userId !== userId) {
      return notFound(res, "兑奖记录不存在");
    }
    const activity = findActivity(store, entry.activityId);
    return sendJson(res, 200, buildUserRecord(entry, activity));
  }

  if (mobileRedeemMatch && method === "POST") {
    const entryId = Number(mobileRedeemMatch[1]);
    const body = await readBody(req);
    const userId = normalizeUserId(body.userId);
    const entry = findEntry(store, entryId);
    if (!entry || entry.userId !== userId) {
      return notFound(res, "兑奖记录不存在");
    }
    if (!entry.isWinner) {
      return badRequest(res, "当前记录不可兑奖");
    }

    entry.recipientName = body.recipientName || entry.recipientName || "";
    entry.phone = body.phone || entry.phone || "";
    entry.address = body.address || entry.address || "";
    entry.redeemStatus = "待发货";
    entry.shippingStatus = "待发货";

    await writeStore(store);
    return sendJson(res, 200, buildUserRecord(entry, findActivity(store, entry.activityId)));
  }

  const mobileJoinMatch = pathname.match(/^\/api\/mobile\/activities\/(\d+)\/join$/);
  if (mobileJoinMatch && method === "POST") {
    const activityId = Number(mobileJoinMatch[1]);
    const activity = findActivity(store, activityId);
    if (!activity) {
      return notFound(res, "活动不存在");
    }

    if (activity.status === "已结束" || activity.status === "已开奖") {
      return badRequest(res, "当前活动不可参与");
    }

    const body = await readBody(req);
    const userId = normalizeUserId(body.userId);
    const source = body.source || (activity.tasks && activity.tasks[0]) || "用户端参与";
    const userEntries = getUserEntries(store, activityId, userId);
    const joinLimitNumber = getJoinLimitNumber(activity.joinLimit);
    if (joinLimitNumber !== null && userEntries.length >= joinLimitNumber) {
      return badRequest(res, "已达到当前活动参与次数上限");
    }

    const today = formatDate(new Date()).slice(0, 10);
    if (activity.joinLimit === "每天1次") {
      const joinedToday = userEntries.some((entry) => formatDate(entry.obtainedAt).slice(0, 10) === today);
      if (joinedToday) {
        return badRequest(res, "今日已参与，请明天再来");
      }
    }

    const entry = {
      id: store.nextIds.entry++,
      activityId,
      userId,
      nickname: `测试用户${userId}`,
      code: generateEntryCode(store),
      obtainedAt: new Date().toISOString(),
      source,
      status: "待开奖",
      prizeId: null,
      prizeName: "",
      isWinner: false
    };

    store.entries.push(entry);
    activity.entryCount = Number(activity.entryCount || 0) + 1;
    const hasUserAlreadyJoined = userEntries.length > 0;
    if (!hasUserAlreadyJoined) {
      activity.participantCount = Number(activity.participantCount || 0) + 1;
    }

    await writeStore(store);
    return sendJson(res, 201, {
      message: "参与成功",
      entry: {
        ...entry,
        obtainedAtLabel: formatDate(entry.obtainedAt)
      },
      activity: getUserActivityView(store, activity, userId)
    });
  }

  if (pathname === "/api/activities" && method === "POST") {
    const body = await readBody(req);
    if (!body.name) {
      return badRequest(res, "活动名称不能为空");
    }
    const activity = {
      id: store.nextIds.activity++,
      name: body.name,
      startTime: body.startTime || new Date().toISOString(),
      endTime: body.endTime || new Date().toISOString(),
      drawTime: body.drawTime || new Date().toISOString(),
      status: body.status || "草稿",
      participantCount: 0,
      entryCount: 0,
      allowMultiWin: Boolean(body.allowMultiWin),
      interventionRate: Number(body.interventionRate || 0),
      tasks: Array.isArray(body.tasks) ? body.tasks : []
    };
    store.activities.unshift(activity);
    await writeStore(store);
    return sendJson(res, 201, enrichActivity(activity, store));
  }

  const activityMatch = pathname.match(/^\/api\/activities\/(\d+)$/);
  if (activityMatch && method === "GET") {
    const activityId = Number(activityMatch[1]);
    const activity = findActivity(store, activityId);
    if (!activity) {
      return notFound(res, "活动不存在");
    }
    return sendJson(res, 200, buildActivityDetail(store, activity));
  }

  if (activityMatch && method === "PUT") {
    const activityId = Number(activityMatch[1]);
    const activity = findActivity(store, activityId);
    if (!activity) {
      return notFound(res, "活动不存在");
    }
    const body = await readBody(req);
    if (!body.name) {
      return badRequest(res, "活动名称不能为空");
    }

    activity.name = body.name;
    activity.startTime = body.startTime || activity.startTime;
    activity.endTime = body.endTime || activity.endTime;
    activity.drawTime = body.drawTime || activity.drawTime;
    activity.status = body.status || activity.status;
    activity.allowMultiWin = Boolean(body.allowMultiWin);
    activity.interventionRate = Number(body.interventionRate || 0);
    activity.tasks = Array.isArray(body.tasks) ? body.tasks : activity.tasks;
    activity.joinLimit = body.joinLimit || activity.joinLimit || "每天1次";
    activity.description = body.description || "";
    activity.buttonText = body.buttonText || "立即参与抽奖";
    activity.subtitle = body.subtitle || "";

    await writeStore(store);
    return sendJson(res, 200, buildActivityDetail(store, activity));
  }

  const activityPrizesMatch = pathname.match(/^\/api\/activities\/(\d+)\/prizes$/);
  if (activityPrizesMatch && method === "GET") {
    const activityId = Number(activityPrizesMatch[1]);
    return sendJson(res, 200, store.prizes.filter((prize) => prize.activityId === activityId));
  }

  if (activityPrizesMatch && method === "POST") {
    const activityId = Number(activityPrizesMatch[1]);
    const body = await readBody(req);
    if (!body.name) {
      return badRequest(res, "奖品名称不能为空");
    }
    const prize = {
      id: store.nextIds.prize++,
      activityId,
      level: Number(body.level || 1),
      name: body.name,
      quantity: Number(body.quantity || 1),
      awarded: 0,
      type: body.type || "实物",
      deletable: true
    };
    store.prizes.push(prize);
    await writeStore(store);
    return sendJson(res, 201, prize);
  }

  const prizeMatch = pathname.match(/^\/api\/prizes\/(\d+)$/);
  if (prizeMatch && method === "DELETE") {
    const prizeId = Number(prizeMatch[1]);
    const prize = store.prizes.find((item) => item.id === prizeId);
    if (!prize) {
      return notFound(res, "奖品不存在");
    }
    if (!prize.deletable) {
      return badRequest(res, "该奖品不允许删除");
    }
    store.prizes = store.prizes.filter((item) => item.id !== prizeId);
    await writeStore(store);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/entries" && method === "GET") {
    const activityIdParam = url.searchParams.get("activityId");
    const list = store.entries
      .filter((entry) => (activityIdParam ? entry.activityId === Number(activityIdParam) : true))
      .sort((a, b) => new Date(b.obtainedAt) - new Date(a.obtainedAt))
      .map((entry) => ({
        ...entry,
        obtainedAtLabel: formatDate(entry.obtainedAt)
      }));
    return sendJson(res, 200, list);
  }

  if (pathname === "/api/draws" && method === "GET") {
    const list = store.activities.map((activity) => {
      const enriched = enrichActivity(activity, store);
      const pendingEntries = store.entries.filter((entry) => entry.activityId === activity.id && entry.status === "待开奖").length;
      return {
        ...enriched,
        pendingEntries
      };
    });
    return sendJson(res, 200, list);
  }

  const runDrawMatch = pathname.match(/^\/api\/draws\/(\d+)\/run$/);
  if (runDrawMatch && method === "POST") {
    const activityId = Number(runDrawMatch[1]);
    const activity = store.activities.find((item) => item.id === activityId);
    if (!activity) {
      return notFound(res, "活动不存在");
    }
    const pendingEntries = store.entries.filter((entry) => entry.activityId === activityId && entry.status === "待开奖");
    const prizePool = store.prizes
      .filter((prize) => prize.activityId === activityId && prize.level < 99)
      .sort((a, b) => a.level - b.level);

    let cursor = 0;
    for (const prize of prizePool) {
      const awardedCount = store.entries.filter((entry) => entry.prizeId === prize.id).length;
      const quota = Math.max(0, prize.quantity - awardedCount);
      for (let index = 0; index < quota && cursor < pendingEntries.length; index += 1) {
        const entry = pendingEntries[cursor++];
        entry.status = "已中奖";
        entry.isWinner = true;
        entry.prizeId = prize.id;
        entry.prizeName = getPrizeLabel(prize);
      }
    }

    for (; cursor < pendingEntries.length; cursor += 1) {
      const entry = pendingEntries[cursor];
      entry.status = "已开奖";
      entry.isWinner = false;
      entry.prizeId = null;
      entry.prizeName = "谢谢参与";
    }

    activity.status = "已开奖";
    await writeStore(store);
    return sendJson(res, 200, {
      ok: true,
      activity: enrichActivity(activity, store),
      winners: store.entries.filter((entry) => entry.activityId === activityId && entry.isWinner)
    });
  }

  if (pathname === "/api/winners" && method === "GET") {
    const activityId = Number(url.searchParams.get("activityId") || 1001);
    const winners = store.entries
      .filter((entry) => entry.activityId === activityId && (entry.isWinner || entry.status === "已开奖"))
      .map((entry) => ({
        ...entry,
        obtainedAtLabel: formatDate(entry.obtainedAt)
      }));
    return sendJson(res, 200, winners);
  }

  const interventionMatch = pathname.match(/^\/api\/winners\/(\d+)\/intervene$/);
  if (interventionMatch && method === "POST") {
    const entryId = Number(interventionMatch[1]);
    const body = await readBody(req);
    const entry = store.entries.find((item) => item.id === entryId);
    if (!entry) {
      return notFound(res, "参与记录不存在");
    }

    const action = body.action || "改奖";
    if (action === "取消中奖") {
      entry.isWinner = false;
      entry.status = "已开奖";
      entry.prizeId = null;
      entry.prizeName = "谢谢参与";
    } else {
      const prizeId = Number(body.prizeId);
      const prize = store.prizes.find((item) => item.id === prizeId);
      if (!prize) {
        return badRequest(res, "目标奖品不存在");
      }
      entry.isWinner = true;
      entry.status = "已中奖";
      entry.prizeId = prize.id;
      entry.prizeName = getPrizeLabel(prize);
    }

    store.interventionLogs.unshift({
      id: store.nextIds.log++,
      entryId: entry.id,
      action,
      remark: body.remark || "后台人工处理",
      operator: body.operator || "admin",
      createdAt: new Date().toISOString()
    });

    await writeStore(store);
    return sendJson(res, 200, entry);
  }

  if (pathname === "/api/logs" && method === "GET") {
    const logs = store.interventionLogs.map((log) => ({
      ...log,
      createdAtLabel: formatDate(log.createdAt)
    }));
    return sendJson(res, 200, logs);
  }

  if (pathname === "/api/statistics" && method === "GET") {
    return sendJson(res, 200, buildStatistics(store));
  }

  return notFound(res);
}

async function serveStatic(req, res, url) {
  let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
  if (url.pathname === "/") {
    filePath = path.join(ROOT, "dashboard.html");
  }

  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(ROOT)) {
    return notFound(res);
  }

  try {
    const stat = await fsp.stat(normalized);
    if (stat.isDirectory()) {
      return notFound(res);
    }
    const ext = path.extname(normalized).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(normalized).pipe(res);
  } catch (error) {
    notFound(res);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendText(res, 500, error.message || "Server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Draw prize server running at http://${HOST}:${PORT}`);
});
