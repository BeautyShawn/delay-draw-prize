const api = {
  async request(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      let message = "请求失败";
      try {
        const payload = await response.json();
        message = payload.error || message;
      } catch (error) {
        // Ignore JSON parse failure and use default message.
      }
      throw new Error(message);
    }

    return response.json();
  },
  get(url) {
    return this.request(url);
  },
  post(url, body) {
    return this.request(url, {
      method: "POST",
      body: JSON.stringify(body || {})
    });
  },
  put(url, body) {
    return this.request(url, {
      method: "PUT",
      body: JSON.stringify(body || {})
    });
  },
  delete(url) {
    return this.request(url, { method: "DELETE" });
  }
};

function initMenuHighlight() {
  const currentPath = window.location.pathname.split("/").pop() || "dashboard.html";
  document.querySelectorAll("li").forEach((li) => {
    const target = li.dataset.page || li.getAttribute("onclick")?.match(/'([^']+\.html)'/)?.[1];
    if (target === currentPath) {
      li.style.background = "#1890ff";
      li.style.fontWeight = "bold";
    }
    li.addEventListener("mouseover", () => {
      if (!li.style.background.includes("#1890ff")) {
        li.style.background = "#0f2a47";
      }
    });
    li.addEventListener("mouseout", () => {
      if (!li.style.background.includes("#1890ff")) {
        li.style.background = "";
      }
    });
  });
}

function formatDateTime(dateString) {
  if (!dateString) {
    return "-";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(new Date(dateString))
    .replace(/\//g, "-");
}

function showMessage(message) {
  window.alert(message);
}

function initAdminFloatingNav() {
  const existing = document.querySelector(".admin-float-nav");
  if (existing) {
    existing.remove();
  }
}

window.app = {
  api,
  formatDateTime,
  initMenuHighlight,
  initAdminFloatingNav,
  showMessage
};
