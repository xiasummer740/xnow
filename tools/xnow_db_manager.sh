#!/bin/bash

# -----------------------------------------------------------
# XNOW Project - Database Disaster Recovery & Management Engine
# Author: Full Stack Automation Expert
# Version: v2.12.0 (Data Security Milestone)
# -----------------------------------------------------------

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

BACKUP_DIR="/root/xnow_backups"
ENV_FILE="/var/www/xnow/server/.env"

# 确保备份目录存在
mkdir -p "$BACKUP_DIR"

# 获取数据库密码
if [ -f "$ENV_FILE" ]; then
    DB_PASS=$(grep DB_PASS "$ENV_FILE" | cut -d '=' -f2 | tr -d '\r')
    DB_USER=$(grep DB_USER "$ENV_FILE" | cut -d '=' -f2 | tr -d '\r')
    DB_NAME=$(grep DB_NAME "$ENV_FILE" | cut -d '=' -f2 | tr -d '\r')
else
    echo -e "${RED}❌ 致命错误：找不到环境配置文件 (.env)。系统是否已部署？${NC}"
    exit 1
fi

if [ -z "$DB_PASS" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo -e "${RED}❌ 致命错误：无法从 .env 提取数据库凭证！${NC}"
    exit 1
fi

show_menu() {
    clear
    echo -e "${CYAN}========================================================${NC}"
    echo -e "${YELLOW} 🛡️ XNOW 商业级数据灾备与恢复中心 (Disaster Recovery) ${NC}"
    echo -e "${CYAN}========================================================${NC}"
    echo -e " 1. ${GREEN}📦 立即备份全站数据${NC} (生成极小体积的 GZIP 压缩包)"
    echo -e " 2. ${RED}🔄 灾难级数据恢复${NC} (从备份包还原，将覆盖现有数据)"
    echo -e " 3. ${YELLOW}🧹 清理历史备份文件${NC} (释放 VPS 磁盘空间)"
    echo -e " 0. 退出引擎"
    echo -e "${CYAN}========================================================${NC}"
    echo -e "备份文件存放路径: ${YELLOW}$BACKUP_DIR${NC}"
    read -p "👉 请选择操作 (0-3): " choice
    handle_choice "$choice"
}

backup_db() {
    echo -e "\n${CYAN}⏳ 正在对数据库 '$DB_NAME' 执行冷冻级快照...${NC}"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/xnow_backup_$TIMESTAMP.sql.gz"
    
    # 导出并直接 gzip 压缩，极大减少体积
    mysqldump -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"
    
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo -e "${GREEN}✅ 备份成功！${NC}"
        echo -e "📦 备份文件: ${YELLOW}$BACKUP_FILE${NC}"
        echo -e "ℹ️  文件大小: $(du -h "$BACKUP_FILE" | cut -f1)"
        echo -e "\n${RED}⚠️ 强烈建议：请立即使用 SFTP/Xftp 软件将此文件下载到您的个人电脑！${NC}"
    else
        echo -e "${RED}❌ 备份失败！请检查 MySQL 状态或磁盘空间。${NC}"
        rm -f "$BACKUP_FILE"
    fi
    read -p "按回车键返回菜单..."
    show_menu
}

restore_db() {
    echo -e "\n${YELLOW}⚠️ 警告：此操作将彻底清空当前数据库，并使用备份文件覆盖！${NC}"
    read -p "您确定要继续吗？(输入 yes 确认): " confirm
    if [ "$confirm" != "yes" ]; then
        echo -e "${CYAN}已取消恢复操作。${NC}"
        read -p "按回车键返回菜单..."
        show_menu
        return
    fi

    echo -e "\n${CYAN}📂 请从下方选择要恢复的备份文件：${NC}"
    # 列出目录下的备份文件
    mapfile -t backups < <(ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null)
    
    if [ ${#backups[@]} -eq 0 ]; then
        echo -e "${RED}❌ 未在 $BACKUP_DIR 找到任何 .sql.gz 备份文件！${NC}"
        echo -e "如果您是在新服务器上恢复，请先将备份文件上传至 ${YELLOW}$BACKUP_DIR${NC} 目录。"
        read -p "按回车键返回菜单..."
        show_menu
        return
    fi

    for i in "${!backups[@]}"; do
        echo -e " [$i] $(basename "${backups[$i]}")  ($(du -h "${backups[$i]}" | cut -f1))"
    done

    read -p "👉 请输入对应编号 (0-$(( ${#backups[@]} - 1 ))): " b_index

    if [[ ! "$b_index" =~ ^[0-9]+$ ]] || [ "$b_index" -lt 0 ] || [ "$b_index" -ge "${#backups[@]}" ]; then
        echo -e "${RED}❌ 无效的选择！${NC}"
        read -p "按回车键返回菜单..."
        show_menu
        return
    fi

    TARGET_FILE="${backups[$b_index]}"
    echo -e "\n${CYAN}⏳ 正在停止后端业务进程，防止数据写入冲突...${NC}"
    pm2 stop xnow-backend >/dev/null 2>&1

    echo -e "${CYAN}🔥 正在注入历史数据快照: $(basename "$TARGET_FILE")...${NC}"
    
    # 解压并导入
    gunzip -c "$TARGET_FILE" | mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据恢复完美成功！您的帝国已满血复活！${NC}"
    else
        echo -e "${RED}❌ 数据恢复过程中出现错误！${NC}"
    fi

    echo -e "${CYAN}🚀 正在重新点火唤醒后端业务进程...${NC}"
    pm2 restart xnow-backend >/dev/null 2>&1
    
    read -p "按回车键返回菜单..."
    show_menu
}

clean_backups() {
    echo -e "\n${CYAN}⏳ 正在清理超过 30 天的陈旧备份...${NC}"
    find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -exec rm -f {} \;
    echo -e "${GREEN}✅ 清理完成！当前保留的备份文件：${NC}"
    ls -lh "$BACKUP_DIR" | awk '{print $5, $9}' | tail -n +2
    read -p "按回车键返回菜单..."
    show_menu
}

handle_choice() {
    case $1 in
        1) backup_db ;;
        2) restore_db ;;
        3) clean_backups ;;
        0) echo -e "${GREEN}安全退出灾备引擎。祝您业务长虹！${NC}"; exit 0 ;;
        *) echo -e "${RED}❌ 无效选项，请重试。${NC}"; sleep 1; show_menu ;;
    esac
}

# 启动菜单
show_menu
