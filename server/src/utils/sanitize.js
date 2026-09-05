import sanitizeHtml from 'sanitize-html';

// 🔒 公告富文本白名单净化：只保留排版标签与内联样式，剥掉 <script>/on*事件/javascript: 等危险内容。
// 上游同步与后台编辑器保存的公告都先过这一层再入库，前端才可安全 v-html 恢复富文本排版。
const WHITELIST = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 'del', 's', 'a',
    'ul', 'ol', 'li', 'blockquote', 'hr', 'sup', 'sub', 'font',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title', 'style'],
    img: ['src', 'alt', 'title', 'style'],
    font: ['color', 'face', 'size', 'style'],
    '*': ['style', 'align', 'dir', 'class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // 链接统一新窗口打开并加 rel，防 opener 反向利用
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

export const sanitizeAnnouncement = (html) =>
  sanitizeHtml(String(html ?? ''), WHITELIST);

// 富文本 → 纯文本（去掉全部标签），用于站内通知等纯文本展示位，避免 HTML 源码裸露
export const announcementToText = (html) =>
  sanitizeAnnouncement(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
