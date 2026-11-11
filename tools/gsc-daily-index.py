#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GSC 每日自动提交收录（无人值守）

背景
----
2026-11-11 实测：新站 199 个页面，Google 只收录了 5 个（2.5%），
30 天曝光 12 次、点击 0。手动在 GSC 点「请求编入索引」是唯一能主动加速的办法。

实测效果：11-09 请求的 3 条（/c/tiktok、/guide/first-1000-followers、
/guide/tiktok-shop），11-11 查询时已经是「已收录」—— 说明这条路有效。

GSC 每日配额约 12-15 条，所以脚本每天提交 N 条（默认 12），
按优先级排序，跳过已经请求过的。

用法
----
    python gsc-daily-index.py              # 提交 12 条
    python gsc-daily-index.py --quota 8    # 自定义条数
    python gsc-daily-index.py --dry-run    # 只列出要提交什么，不真跑浏览器
    python gsc-daily-index.py --reset      # 清空状态文件重新来

状态文件
--------
同目录下的 gsc-requested.json：
    { "requested": { "<url>": "<日期>" }, "lastRun": "<日期>" }

依赖
----
· Chrome 以 --remote-debugging-port=9222 启动（脚本会自动拉起桌面快捷方式）
· GSC 已登录（登录态在 Chrome 用户数据里）
· playwright（已装在 Python 311）

⚠️ 无人值守注意
· 任何异常都不许让整个脚本崩掉 —— 记录日志、退出码 1，等明天再跑
· 浏览器没开会自动拉起，拉不起来就记日志退出
· GSC 登录态失效会检测到并提示人工重新登录
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(HERE, "gsc-requested.json")
LOG_FILE = os.path.join(HERE, "gsc-daily-index.log")

SITE = "https://xnow.taikon.top"
SITEMAP = f"{SITE}/sitemap.xml"
GSC_BASE = "https://search.google.com/search-console?resource_id=https%3A%2F%2Fxnow.taikon.top%2F"
CDP_URL = "http://127.0.0.1:9222"
CHROME_LNK = r"G:\Users\Administrator\Desktop\AI浏览器.lnk"

# 每天提交多少条（GSC 实测配额 12-15，留余量）
DEFAULT_QUOTA = 12
# 每条之间歇多久（太密容易被判异常）
DELAY_BETWEEN = 3.0

BJ = timezone(timedelta(hours=8))


def log(msg):
    """写日志到文件 + 标准输出。Windows 计划任务里 stdout 是黑洞，文件才留得下。"""
    line = f"[{datetime.now(BJ).strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            d = json.load(f)
            d.setdefault("requested", {})
            return d
    except Exception:
        return {"requested": {}, "lastRun": None}


def save_state(state):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=1)
    except Exception as e:
        log(f"⚠️ 状态文件写入失败: {e}")


def fetch_sitemap_urls():
    """拿 sitemap 里所有 URL。失败返回空列表（下一轮再试）。"""
    try:
        req = urllib.request.Request(SITEMAP, headers={"User-Agent": "xnow-gsc-bot/1.0"})
        xml = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")
        urls = re.findall(r"<loc>([^<]+)</loc>", xml)
        log(f"sitemap 拿到 {len(urls)} 条 URL")
        return urls
    except Exception as e:
        log(f"❌ sitemap 拉取失败: {e}")
        return []


def priority_of(url):
    """
    优先级（数字越小越先提交）。

    为什么这个顺序：
      ① 知识库 —— 有实质内容、长尾问答，Google 最愿意收，也是转化漏斗的入口
      ② 平台页 —— 有交易意图，但竞争大，需要尽快让 Google 知道最新标题
      ③ 类型子页 —— 内容薄，靠后
      ④ 语种页 —— 多语种权重低，最后
      ⑤ 首页 / 价格表 —— **放最后**：这两个 11-08 就收录了，
         排前面只会每条多花 15 秒去确认「已收录」，白占配额。真没收录时
         轮到最后也照样会被提交，只是顺序靠后而已。
    """
    p = url.replace(SITE, "") or "/"
    if p.startswith("/guide/"):
        return 1          # 知识库文章（22 篇，最优先）
    if p == "/guide":
        return 2          # 知识库列表
    if p.startswith("/c/") and p.count("/") == 2:
        return 3          # 平台主页 /c/tiktok
    if p.startswith("/en") or p.startswith("/id") or p.startswith("/pt") \
       or p.startswith("/vi") or p.startswith("/ar") or p.startswith("/ru"):
        return 9          # 语种页最后
    if p.startswith("/c/"):
        return 5          # 类型子页
    if p == "/" or p == "/price":
        return 8          # 早已收录，排后面（不浪费前几条配额）
    return 4


def pick_targets(all_urls, state, quota):
    """排出今天要提交的 URL：跳过已请求过的，按优先级排序，取前 quota 条。"""
    requested = state.get("requested", {})
    todo = [u for u in all_urls if u not in requested]
    # 同优先级内按 URL 长度排（短路径通常更基础，先提交）
    todo.sort(key=lambda u: (priority_of(u), len(u), u))
    return todo[:quota]


def ensure_browser():
    """确保 CDP 端口可用；没有就拉起桌面快捷方式等一会儿。"""
    for _ in range(2):
        try:
            with urllib.request.urlopen(f"{CDP_URL}/json/version", timeout=5) as r:
                info = json.loads(r.read())
            log(f"浏览器就绪: {info.get('Browser', '?')}")
            return True
        except Exception:
            pass
        if os.path.exists(CHROME_LNK):
            log("浏览器未启动，尝试拉起…")
            try:
                subprocess.Popen(["cmd", "/c", "start", "", CHROME_LNK], shell=False)
            except Exception as e:
                log(f"⚠️ 拉起失败: {e}")
            time.sleep(18)
        else:
            log(f"⚠️ 快捷方式不存在: {CHROME_LNK}")
            time.sleep(2)
    log("❌ 浏览器仍不可用，本轮放弃")
    return False


def request_one(page, url):
    """
    在 GSC 里对单个 URL 点「请求编入索引」。
    返回 'ok' | 'already' | 'quota' | 'login' | 'unknown' | 'error'
    """
    try:
        page.goto(GSC_BASE, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(6500)

        # 登录态检查：没登录会停在 accounts.google.com
        if "accounts.google.com" in page.url or "signin" in page.url:
            log("❌ GSC 登录态失效，需要人工重新登录")
            return "login"

        page.mouse.click(474, 32)
        page.wait_for_timeout(1100)
        page.keyboard.press("Control+A")
        page.keyboard.type(url, delay=18)
        page.wait_for_timeout(1500)
        page.keyboard.press("Enter")
        page.wait_for_timeout(15000)

        body = page.inner_text("body") or ""

        # ⚠️ 2026-11-11 实测踩的坑：不能拿「已编入索引」当已收录的判据 ——
        #    GSC 页面底部有一句「仅已编入索引的网址有增强选项」，任何页面都含这四个字。
        #    只用这两句明确的：
        #      未收录 → 「网址尚未收录到 Google」
        #      已收录 → 「网址在 Google 上」
        if "网址尚未收录" in body:
            pass  # 需要请求，继续往下
        elif "网址在 Google 上" in body:
            return "already"
        else:
            # 页面没加载完整 / 登录页 / 其它 —— 不猜，算失败
            return "unknown"

        btn = page.evaluate(
            """() => {
              var x = [...document.querySelectorAll('*')].find(
                e => (e.innerText||'').trim() === '请求编入索引' && e.offsetParent && e.children.length === 0);
              if (!x) return null;
              var r = x.getBoundingClientRect();
              return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)};
            }"""
        )
        if not btn:
            return "unknown"

        page.mouse.click(btn["x"], btn["y"])
        page.wait_for_timeout(12000)

        body2 = page.inner_text("body") or ""
        if "已请求编入索引" in body2:
            return "ok"
        if "配额" in body2 or "上限" in body2 or "稍后再试" in body2:
            return "quota"

        # 再等一轮确认（网络慢时会延迟弹）
        page.wait_for_timeout(6000)
        body3 = page.inner_text("body") or ""
        if "已请求编入索引" in body3:
            return "ok"
        if "配额" in body3 or "上限" in body3:
            return "quota"

        # 🕳 实测：GSC 配额用尽时**不给任何文字提示**，点下去毫无反应。
        #    所以这里不能只靠关键词，改为看「按钮还在不在」——
        #    请求成功的按钮会消失（或整个面板换成排队说明），
        #    配额用尽时按钮原地不动。
        btn_after = page.evaluate(
            """() => {
              var x = [...document.querySelectorAll('*')].find(
                e => (e.innerText||'').trim() === '请求编入索引' && e.offsetParent && e.children.length === 0);
              return !!x;
            }"""
        )
        if not btn_after:
            return "ok"          # 按钮消失了 = 请求已受理
        return "unknown"

    except Exception as e:
        log(f"  ⚠️ 请求异常 {url}: {str(e)[:80]}")
        return "error"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quota", type=int, default=DEFAULT_QUOTA, help="本轮提交条数")
    ap.add_argument("--dry-run", action="store_true", help="只列出计划，不执行")
    ap.add_argument("--reset", action="store_true", help="清空已请求记录")
    args = ap.parse_args()

    log("=" * 60)
    log(f"GSC 每日提交开始（配额 {args.quota} 条）")

    state = load_state()
    if args.reset:
        state = {"requested": {}, "lastRun": None}
        save_state(state)
        log("状态已重置")

    # 同一天重复跑要防重（计划任务可能被触发两次）
    today = datetime.now(BJ).strftime("%Y-%m-%d")
    if state.get("lastRun") == today and not args.dry_run:
        log(f"今天（{today}）已经跑过了，跳过。要重跑请加 --reset 或改状态文件")
        return 0

    urls = fetch_sitemap_urls()
    if not urls:
        log("sitemap 为空，退出")
        return 1

    targets = pick_targets(urls, state, args.quota)
    if not targets:
        log("✅ 所有页面都已请求过，没有待提交的")
        return 0

    log(f"待提交 {len(targets)} 条：")
    for t in targets:
        log(f"  {t.replace(SITE, '') or '/'}")

    if args.dry_run:
        log("（--dry-run，不执行）")
        return 0

    if not ensure_browser():
        return 1

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log("❌ 缺少 playwright，请先 pip install playwright")
        return 1

    ok = already = 0
    consecutive_fail = 0
    failed = []
    quota_hit = False
    login_lost = False

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        page = ctx.new_page()
        page.set_viewport_size({"width": 1440, "height": 1100})

        for i, url in enumerate(targets, 1):
            short = url.replace(SITE, "") or "/"
            log(f"[{i}/{len(targets)}] {short}")
            r = request_one(page, url)

            if r == "ok":
                ok += 1
                log("  ✅ 已请求")
                state.setdefault("requested", {})[url] = today
                save_state(state)          # 每条都存，中途崩了不丢进度
            elif r == "already":
                already += 1
                log("  ✓ 已收录，无需请求")
                state.setdefault("requested", {})[url] = f"{today}(已收录)"
                save_state(state)
            elif r == "quota":
                quota_hit = True
                log("  ⚠️ 配额用完，本轮停止（明天继续）")
                break
            elif r == "login":
                login_lost = True
                log("  ❌ 登录态失效，本轮停止")
                break
            else:
                failed.append(url)
                consecutive_fail += 1
                log(f"  ? 状态不明，留待下次重试（连续失败 {consecutive_fail} 次）")
                # 配额用尽时每条都会「点下去没反应」，没有文字提示。
                # 连续 3 条不明就认定这不是偶发问题，直接停 —— 否则每天白跑 12 条
                # 每次 30 秒，纯浪费。状态文件里已请求的那些不受影响。
                if consecutive_fail >= 3:
                    log("  ⚠️ 连续 3 条无响应，判定本轮配额/登录异常，提前停止")
                    quota_hit = True
                    break

            time.sleep(DELAY_BETWEEN)

        page.close()

    state["lastRun"] = today
    save_state(state)

    log("-" * 60)
    log(f"完成：请求成功 {ok} / 已收录 {already} / 失败 {len(failed)}")
    if quota_hit:
        log("配额已用完，明天再跑")
    if login_lost:
        log("⚠️ 需要人工打开 Chrome 重新登录 GSC")
    log("=" * 60)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log(f"💥 未捕获异常: {e}")
        sys.exit(1)

