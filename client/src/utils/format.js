// Shared formatting utilities

export function formatTrafficUsed(c) {
  const bytes = (parseInt(c.traffic_used_up || 0) + parseInt(c.traffic_used_down || 0));
  if (!bytes || bytes === 0) return '0';
  const gb = bytes / 1073741824;
  return gb >= 1 ? gb.toFixed(2) : (bytes / 1048576).toFixed(1);
}

export function formatBytes(bytes) {
  return formatTrafficUsed({ traffic_used_up: bytes, traffic_used_down: 0 });
}

export function formatExpiry(ts) {
  return ts ? new Date(ts).toLocaleDateString('zh-CN') : '--';
}

export function isExpired(ts) {
  return !ts || Date.now() > ts;
}

export function trafficPercent(c) {
  const used = parseInt(c.traffic_used_up || 0) + parseInt(c.traffic_used_down || 0);
  const total = (c.traffic_gb || 1) * 1073741824;
  return Math.min(Math.round((used / total) * 100), 100);
}
