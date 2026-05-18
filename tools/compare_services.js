const { execSync } = require("child_process");
const fs = require("fs");

const dbPass = process.env.DB_PASS;
const upstreamData = JSON.parse(fs.readFileSync("/tmp/upstream_services.json", "utf8"));

// Get xnow service IDs
const raw = execSync(
  `mysql -u root -p${dbPass} xnow_db -sN -e "SELECT service_id FROM services ORDER BY service_id" 2>/dev/null`,
  { encoding: "utf8" }
);
const xnowIds = new Set(raw.trim().split("\n").map(s => s.trim()).filter(Boolean));

const upstreamIds = upstreamData.map(s => String(s.service));
const upstreamSet = new Set(upstreamIds);

// Missing: in upstream but not in xnow
const missing = upstreamIds.filter(id => !xnowIds.has(id));
console.log("上游服务总数: " + upstreamIds.length);
console.log("xnow 服务总数: " + xnowIds.size);
console.log("xnow 缺失的服务: " + missing.length);

if (missing.length > 0) {
  console.log("\n缺失ID列表(前50):");
  missing.slice(0, 50).forEach(id => {
    const s = upstreamData.find(x => String(x.service) === id);
    console.log(`  ID=${id} | ${s.name} | ${s.category} | ¥${s.rate}`);
  });
  if (missing.length > 50) console.log(`  ... 还有 ${missing.length - 50} 个`);
}

// Extra: in xnow but not in upstream
const extra = [...xnowIds].filter(id => !upstreamSet.has(id));
console.log("\nxnow 多余(上游已下架): " + extra.length);
if (extra.length > 0) {
  console.log("多余ID: " + extra.join(", "));
}

// Check if API has duplicate service IDs
const idCounts = {};
upstreamIds.forEach(id => idCounts[id] = (idCounts[id] || 0) + 1);
const dupes = Object.entries(idCounts).filter(([k, v]) => v > 1);
if (dupes.length > 0) {
  console.log("\n⚠️ 上游API有重复ID: " + dupes.map(([k,v]) => `${k}(${v}次)`).join(", "));
}
