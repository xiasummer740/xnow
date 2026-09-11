import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export const authenticate = async (req, res, next) => {
  // 💡 核心修复：同时支持 Header 鉴权与 URL Query 鉴权
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;

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
    user = await User.findByPk(decoded.id, { attributes: ['id', 'phone', 'role', 'is_banned', 'ban_reason'] });
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
  req.user = { id: user.id, phone: user.phone, role: user.role };

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
