import jwt from 'jsonwebtoken';

export const authenticate = async (req, res, next) => {
  // 💡 核心修复：同时支持 Header 鉴权与 URL Query 鉴权
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;

  if (!token) {
    return res.status(401).json({ status: 'error', message: '未授权的访问' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // 💡 核心加法：滑动窗口静默续签逻辑
    const now = Math.floor(Date.now() / 1000);
    const timeToExpire = decoded.exp - now;
    
    // 如果 Token 有效期剩余不足 6 天 (小于 6天 * 24小时 * 60分 * 60秒 = 518400 秒)
    // 则在 Header 中签发一个新的 7 天 Token 供前端静默替换
    if (timeToExpire < 518400) {
        const newToken = jwt.sign(
            { id: decoded.id, role: decoded.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        // 允许跨域前端读取这个自定义 Header
        res.setHeader('Access-Control-Expose-Headers', 'x-new-token');
        res.setHeader('x-new-token', newToken);
    }

    next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: '登录状态已失效，请重新登录' });
  }
};
