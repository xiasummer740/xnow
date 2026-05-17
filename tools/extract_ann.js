const https = require("https");

function fetchPage(urlStr, options = {}) {
  const u = new URL(urlStr);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: options.method || "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
        ...(options.headers || {})
      },
      rejectUnauthorized: false
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", (e) => resolve({ error: e.message }));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function extractAnnouncement() {
  const home = await fetchPage("https://tk7188.com/");
  if (home.error) return { error: home.error };

  const cookies = (home.headers["set-cookie"] || []).map(c => c.split(";")[0]);
  const csrfMatch = home.body.match(/name="_csrf"[^>]*value="([^"]+)"/);
  if (!csrfMatch) return { error: "CSRF not found" };

  const params = new URLSearchParams();
  params.append("LoginForm[username]", "18255621695");
  params.append("LoginForm[password]", "xia900221.");
  params.append("_csrf", csrfMatch[1]);

  const login = await fetchPage("https://tk7188.com/", {
    method: "POST",
    headers: { Cookie: cookies.join("; "), "Content-Type": "application/x-www-form-urlencoded", Origin: "https://tk7188.com", Referer: "https://tk7188.com/" },
    body: params.toString()
  });
  console.log("Login status: " + login.status);
  console.log("Login Location: " + (login.headers.location || "none"));
  console.log("Login set-cookie count: " + (login.headers["set-cookie"] || []).length);

  const allCookies = [...cookies];
  (login.headers["set-cookie"] || []).forEach(nc => {
    const name = nc.split("=")[0];
    const idx = allCookies.findIndex(c => c.startsWith(name));
    if (idx >= 0) allCookies[idx] = nc.split(";")[0];
    else allCookies.push(nc.split(";")[0]);
  });

  const dash = await fetchPage("https://tk7188.com/", {
    headers: { Cookie: allCookies.join("; ") }
  });

  console.log("Dash size: " + dash.body.length);
  console.log("Has 退出: " + dash.body.includes("退出"));
  console.log("Has 订单: " + dash.body.includes("订单"));

  const annStart = dash.body.indexOf("刷粉风控期建议");
  if (annStart < 0) {
    // Debug: check what keywords ARE present
    ["TikTok", "风控", "刷粉", "粉丝"].forEach(k => {
      console.log(k + " count: " + (dash.body.match(new RegExp(k, "g")) || []).length);
    });
    return { error: "Announcement not found" };
  }

  const before = dash.body.substring(Math.max(0, annStart - 5000), annStart);
  const blockMatch = before.match(/id="block_(\d+)"/g);
  if (!blockMatch) return { error: "Block not found" };

  const lastBlock = blockMatch[blockMatch.length - 1];
  const blockId = lastBlock.match(/\d+/)[0];

  const blockStartTag = 'id="block_' + blockId + '"';
  const blockStart = dash.body.indexOf(blockStartTag);
  const nextBlockStart = dash.body.indexOf('id="block_', blockStart + blockStartTag.length);
  const blockHtml = dash.body.substring(blockStart, nextBlockStart > 0 ? nextBlockStart : blockStart + 50000);

  const descMatch = blockHtml.match(/<div class="text-block__description">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
  if (!descMatch) return { error: "Description not found" };

  let content = descMatch[1].trim();
  content = content.replace(/var\(--color-id-\d+\)/g, "#ffffff");

  console.log("Content length: " + content.length);
  console.log(content);
  return { content, length: content.length };
}

extractAnnouncement().then(r => {
  if (r.error) console.error("ERROR:", r.error);
});
