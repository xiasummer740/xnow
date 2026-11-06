import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export const authenticate = async (req, res, next) => {
  // 🔒 2026-11-03：**不再接受 ?token= 传令牌**。
  //    URL 里的令牌会被 nginx access.log、Cloudflare 日志、浏览器历史、Referer 头
  //    原样记录下来 —— 一把 7 天有效的令牌就这么散到所有日志里，而且没人会去清。
  //    唯一的合法用途（备份文件下载，浏览器需要走原生下载）已改成 fetch + Blob。
  //    如果以后真需要"链接式下载"，用一次性短时令牌换，不要复用登录令牌。
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ status: 'error', message: '未授权的访问' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    // 过期是正常现象（每个用户 7 天都会碰上一次），记日志只会刷屏；
    // 非过期失败（签名不符/格式错）通常意味着 JWT_SECRET 被改过或有人在伪造 token —— 必须留痕，
    // 否则「全体用户突然被登出」时运维没有任何线索能区分是正常到期还是配置事故。
    if (error.name !== 'TokenExpiredError') {
      console.warn('⚠️ [Auth] Token 验签失败（非过期）:', error.message);
    }
    return res.status(401).json({ status: 'error', message: '登录状态已失效，请重新登录' });
  }

  // 🔒 每次请求回查数据库：封禁、降级、删号立即生效
  // 此前只验签不回查，被封禁/已降权的账号凭旧 Token 仍可继续操作，
  // 叠加下方滑动续签 → 权限实际永久有效（撤销完全失效）。
  // ⚠️ DB 故障必须与「登录失效」分开：前端拿到 401 会直接 logout+弹窗，
  // 若把数据库抖动当成 401，一次抖动就会把全体在线用户踢下线。
  let user;
  try {
    // balance / agent_expire_at / site_id 都要带：
    //   · 计费相关路由（开站、续费）要在这一层就能判断「代理是否到期」，
    //     否则 req.user.agent_expire_at 是 undefined，判断会静默跳过
    //     —— 87 期实测：代理已过期的人仍能开新站并成功扣费。
    //   · site_id 是「分站客户不能用分站管理功能」这道闸门的判据（sites.js 里那条 if）。
    //     ⚠️ 历史的坑：注释写了要带、attributes 里也查了，但下面 req.user 只赋了三个字段，
    //     site_id/balance/agent_expire_at 全被丢掉 → 那道闸门永远不触发（分站客户能自己开站）。
    user = await User.findByPk(decoded.id, { attributes: ['id', 'phone', 'role', 'is_banned', 'ban_reason', 'balance', 'agent_expire_at', 'site_id'] });
  } catch (e) {
    console.error('❌ [Auth] 回查用户失败:', e.message);
    return res.status(503).json({ status: 'error', message: '服务暂时不可用，请稍后重试' });
  }

  if (!user) {
    // 签名有效但查不到用户：不是正常到期，是「用户被删」或「库被重建/连错库」，必须留痕
    console.warn('⚠️ [Auth] Token 有效但用户不存在，UID:', decoded.id);
    return res.status(401).json({ status: 'error', message: '登录状态已失效，请重新登录' });
  }
  if (user.is_banned) {
    return res.status(403).json({ status: 'error', message: user.ban_reason ? `账号已被封禁：${user.ban_reason}` : '账号已被封禁，请联系客服' });
  }

  // 权限一律以数据库为准，不采信 Token 里可能已过期的角色
  // （顺带补上 phone：审计日志 logAudit 一直读 req.user.phone，而 JWT 里从来没有这个字段）
  // 另外把 balance / agent_expire_at / site_id 一并挂上：查询已经取了，丢掉只会让下游静默误判
  req.user = {
    id: user.id,
    phone: user.phone,
    role: user.role,
    balance: user.balance,
    agent_expire_at: Number(user.agent_expire_at || 0),
    site_id: Number(user.site_id || 0),
  };

  // 💡 核心加法：滑动窗口静默续签逻辑
  const now = Math.floor(Date.now() / 1000);
  const timeToExpire = decoded.exp - now;

  // 如果 Token 有效期剩余不足 6 天 (小于 6天 * 24小时 * 60分 * 60秒 = 518400 秒)
  // 则在 Header 中签发一个新的 7 天 Token 供前端静默替换
  if (timeToExpire < 518400) {
    try {
      const newToken = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      // 允许跨域前端读取这个自定义 Header
      res.setHeader('Access-Control-Expose-Headers', 'x-new-token');
      res.setHeader('x-new-token', newToken);
    } catch (e) {
      // 续签失败只影响「延期」，不能拦住已经鉴权通过的请求
      console.error('❌ [Auth] 续签 Token 失败:', e.message);
    }
  }

  next();
};
