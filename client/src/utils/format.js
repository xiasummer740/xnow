// Shared formatting utilities

export function formatTrafficUsed(c) {
  const bytes = (parseInt(c.traffic_used_up || 0) + parseInt(c.traffic_used_down || 0));
  if (!bytes || bytes === 0) return '0';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2);
  return (bytes / 1048576).toFixed(2);
}
export function formatTrafficUnit(c) {
  const bytes = (parseInt(c.traffic_used_up || 0) + parseInt(c.traffic_used_down || 0));
  if (!bytes || bytes === 0) return 'MB';
  return bytes >= 1073741824 ? 'GB' : 'MB';
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
