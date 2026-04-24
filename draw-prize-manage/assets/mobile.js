const mobilePages = [
  { href: "m-index.html", label: "导航" },
  { href: "m-activity-list.html", label: "活动列表" },
  { href: "m-activity-detail.html", label: "活动详情", match: "m-activity-detail.html" },
  { href: "m-activity-new.html", label: "未参与" },
  { href: "m-activity-pending.html", label: "待开奖" },
  { href: "m-activity-lost.html", label: "未中奖" },
  { href: "m-activity-won.html", label: "已中奖" },
  { href: "m-records.html", label: "中奖记录" },
  { href: "m-redeem.html", label: "奖品兑换" }
];

function renderMobileDirectory() {
  const current = window.location.pathname.split("/").pop() || "m-index.html";
  const mounts = document.querySelectorAll("[data-mobile-directory]");
  mounts.forEach((mount) => {
    mount.innerHTML = mobilePages.map((page) => `
      <a class="nav-pill ${(page.match || page.href) === current ? "active" : ""}" href="/${page.href}">${page.label}</a>
    `).join("");
  });
}

const mobileApi = {
  async get(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("加载失败");
    }
    return response.json();
  },
  async post(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {})
    });
    if (!response.ok) {
      let message = "提交失败";
      try {
        const payload = await response.json();
        message = payload.error || message;
      } catch (error) {
        // Ignore parse error.
      }
      throw new Error(message);
    }
    return response.json();
  }
};

function getMobileUserId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("userId") || "23506";
}

document.addEventListener("DOMContentLoaded", renderMobileDirectory);

window.mobileApp = {
  api: mobileApi,
  getUserId: getMobileUserId
};
