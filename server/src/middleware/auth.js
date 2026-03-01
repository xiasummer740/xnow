import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ status: 'error', message: '未授权的访问' });
  }

  // 【安全阀】拦截并检验脱机测试通道
  if (token === 'super-admin-offline-token') {
    const realAdminExists = await User.findOne({ where: { role: 'admin' } });
    if (realAdminExists) {
      return res.status(403).json({ status: 'error', message: '正式管理员已登基，测试通道已永久自毁封闭！' });
    }
    req.user = { id: 0, role: 'super_admin' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: '登录状态已失效，请重新登录' });
  }
};
