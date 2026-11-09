// ============================================================================
// 注册验证码（2026-11-09）
// ----------------------------------------------------------------------------
// 为什么要有这张表：原来验证码存在 `global.verificationCodes`（进程内存里的
// Map）。**每次 pm2 restart 全部丢失** —— 用户点了「获取验证码」、邮件也收到了，
// 但这期间只要后端重启一次，他填进去就报「验证码不存在或已过期，请重新获取」。
//
// 2026-11-09 白天实测踩到：当晚连续部署重启了 5-6 次 pm2，这段时间注册的用户
// 全部卡在验证码这一步（祥哥收到客户反馈截图）。
//
// 落库之后重启不再丢；顺手加了 expires_at 索引，过期记录可以定期清。
// ============================================================================

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const VerificationCode = sequelize.define('VerificationCode', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    // 邮箱（统一小写）；同邮箱只保留最新一条，发送时先删旧的
    email: {
        type: DataTypes.STRING(191),
        allowNull: false,
        unique: true,
    },
    code: {
        type: DataTypes.STRING(16),
        allowNull: false,
    },
    // 过期时间戳（毫秒）。用 BIGINT 而不是 DATE 是为了和原逻辑 Date.now() 直接比
    expires_at: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    // 发送来源 IP —— 出问题时能查到是不是同一个人在反复要码
    ip: {
        type: DataTypes.STRING(64),
        allowNull: true,
    },
}, {
    tableName: 'verification_codes',
    underscored: true,
    timestamps: true,
    indexes: [
        { fields: ['expires_at'] },
    ],
});

export default VerificationCode;
