import paramiko, sys, time

host, port, user, password = "154.9.238.163", 22, "root", "ojqtPUMD5912"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    ssh.connect(host, port, user, password, look_for_keys=False, allow_agent=False)
    print("[OK] SSH 连接成功")

    # git pull
    stdin, stdout, stderr = ssh.exec_command("cd /var/www/xnow && git pull")
    out = stdout.read().decode()
    err = stderr.read().decode()
    print("[GIT PULL]", out.strip() if out.strip() else err.strip())

    # pm2 restart
    stdin, stdout, stderr = ssh.exec_command("pm2 restart xnow")
    out = stdout.read().decode()
    err = stderr.read().decode()
    print("[PM2 RESTART]", out.strip() if out.strip() else err.strip())

    import time; time.sleep(3)

    # check logs
    stdin, stdout, stderr = ssh.exec_command("pm2 logs xnow --lines 20 --nostream")
    logs = stdout.read().decode()
    print("[LOGS]")
    print(logs[-2000:])

    print("[OK] VPS 部署完成")
except Exception as e:
    print(f"[ERR] {e}")
    sys.exit(1)
finally:
    ssh.close()
