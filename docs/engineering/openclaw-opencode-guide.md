---
date: 2026-05-12
---

# 用 OpenClaw 控制 OpenCode：协同模式和实战经验

> 总结 OpenClaw 作为 orchestration layer 与 OpenCode 作为 code execution engine 的配合方法，以及我们在项目中踩过的坑。

## 背景

OpenClaw 和 OpenCode 是两个不同层次的工具：

- **OpenClaw**：任务规划者、调度器、结果汇总者。负责理解需求、拆解步骤、管理多步骤任务的进度。
- **OpenCode**：代码执行者。运行在独立 session 里，有自己的状态管理、session 持久化、JSON 输出格式。

两者的通信机制是 **session**。OpenClaw 通过 `sessions_spawn` 发起任务，通过 `sessions_send` 继续对话，通过 `sessions_list` 和 `sessions_history` 检查状态。

## 操作模式速查

### 1. 发起新任务

**场景**：需要 OpenCode 执行一个独立的多步骤任务，不需要和主 session 共享上下文。

```python
sessions_spawn(
    task="分析代码并提交 PR，repo 是 xxx，分支名 openclaw_dev",
    context="isolated",       # 用干净子 session，不继承当前上下文
    runTimeoutSeconds=600,     # 任务级别 timeout
    runtime="subagent",
)
```

**关键参数**：
- `context="fork"`：继承当前 transcript 上下文（适用于需要知道之前发生了什么的情况）
- `context="isolated"`：干净子 session（适用于独立任务）
- `runTimeoutSeconds`：超过这个时间还没完成就终止

### 2. 继续已有任务

**场景**：OpenCode 已经开始工作了，你想让它继续做下去，或者需要给它更多上下文。

```python
sessions_send(
    sessionKey="tender-bloom",
    message="测试失败了，错误是权限问题，看看是不是 docker 组没加对",
)
```

### 3. 检查任务状态

```python
# 查看所有 session（包含最后一条消息的摘要）
sessions_list(
    includeLastMessage=True,
    messageLimit=3,
)

# 查看某个 session 的详细历史
sessions_history(
    sessionKey="tender-bloom",
    limit=20,
)
```

### 4. 直接执行单次代码任务

**场景**：不需要多步骤对话，只是想让 OpenCode 执行一条命令。

```bash
opencode run "写一个快排算法，返回 JSON 格式" --format json
```

### 5. 回到某个 session 继续工作（TUI 模式）

```bash
# 继续之前某个 session 的交互
opencode -s <session_id>

# 导出 session 对话记录
opencode export <session_id>
```

## 协同模式：OpenClaw 负责任务规划，OpenCode 负责执行

这是我们实践中总结出来的最佳分工：

```
用户 → OpenClaw（主 session）
           ↓ 拆解任务、规划步骤
       sessions_spawn
           ↓ 发起子 session
      OpenCode（子 session）
           ↓ 执行代码
       结果返回
           ↓
      OpenClaw 汇总结果给用户
```

OpenClaw 不直接执行代码，而是通过 spawn/send 控制 OpenCode，适合 **多步骤、需要判断、带上下文继承** 的复杂任务。

## 实战经验：踩坑记录

### 1. 管道内组权限继承失效 — 用 `sg` 替代 `newgrp`

**问题**：在 exec 管道里用 `newgrp docker << 'EOF' ... EOF` 时，组权限没有正确继承，导致 docker socket 访问被拒。

**现象**：
```
PermissionError: [Errno 13] Permission denied: /var/run/docker.sock
```

**原因**：`newgrp` 在管道子进程里行为不稳定，组切换没有正确传递。

**解决**：改用 `sg docker -c "..."`：

```bash
sg docker -c "timeout 600 python3 -m pytest tests/ -v"
```

### 2. 长任务用 background + poll，避免同步阻塞

**问题**：测试要跑 3-4 分钟，如果用同步 exec 会卡住，而且 session 断开就丢了。

**解决**：

```python
exec(
    command="sg docker -c 'timeout 600 python3 -m pytest tests/'",
    yieldMs=30000,   # 30秒后自动转入后台
)
```

然后用 `process(action=poll)` 检查状态，或者用 `process(action=kill)` 终止卡住的任务。

### 3. Session 可以中断后继续

OpenCode 的 session 是持久化的。任务跑到一半关掉，下次用 `opencode -s <session_id>` 回去继续。

这个设计很适合 **需要长时间观察、不想一直盯着** 的场景。

### 4. 测试失败排查顺序：服务 → 端点参数 → 日志

遇到测试超时或失败，按这个顺序排查：

1. **服务在线吗**：`curl http://localhost:8000/health`
2. **API 参数对吗**：看 OpenAPI schema 确认 body 字段
3. **容器日志**：`docker logs <container_id> --tail 50`
4. **进程状态**：`ps aux | grep <name>` + `ss -tlnp | grep <port>`

### 5. Docker build 在资源紧张时容易 OOM

**问题**：编译型任务（Python pip install、cargo build）容易触发 OOM killer，build 进程被直接 kill。

**解决**：
- 预先拉取基础镜像，手动 commit 安装了依赖的容器
- 用 `docker system prune -af` 回收空间
- 资源紧张时避免多步骤 build，一次只跑一个

```bash
# 预拉取镜像
docker pull python:3.12-slim

# 在容器里装依赖再 commit
cid=$(docker run -d --name builder python:3.12-slim sleep infinity)
docker exec $cid pip install fastapi uvicorn httpx
docker commit $cid my-fastapi:latest
docker kill $cid && docker rm $cid
```

### 6. 权限问题的本质：理解 Linux 组机制

Docker socket 的权限检查的是进程的真实组 ID，不是有效组 ID。在管道里 `groups` 显示正确不代表 docker 命令能访问。

验证方法：
```bash
# 在容器里检查真实组
docker exec <container_id> id
# 输出应该是: uid=0(root) gid=0(root) groups=...,docker(997)

# 在 host 上检查 socket 权限
ls -la /var/run/docker.sock
# 输出应该是: srw-rw---- 1 root docker ...
```

## 常用命令速查

```bash
# 列出所有 OpenCode session
opencode session list

# 继续某个 session 的 TUI
opencode -s <session_id>

# 导出 session 对话
opencode export <session_id>

# 在指定 session 里继续执行
opencode run "<任务>" --session <session_id> --dangerously-skip-permissions

# 强制在子进程里获得 docker 组权限
sg docker -c "<命令>"
```

## 适用场景判断

| 场景 | 用 OpenCode 还是 exec |
|------|----------------------|
| 单次命令执行 | exec |
| 多步骤、需要上下文继承的复杂任务 | sessions_spawn + sessions_send |
| 需要中途停止、之后继续的任务 | sessions_spawn + opencode -s |
| 快速验证想法、不需要持久化 | exec + opencode run |
| 需要并行了多个独立任务 | sessions_spawn（多个）+ subagents |
| 需要聚合多个服务的输出 | OpenClaw 作为 orchestrator |

## 总结

OpenClaw + OpenCode 的协同模式，本质是 **orchestrator + execution engine** 的分离。OpenClaw 负责决策和协调，OpenCode 负责执行，两者通过 session 机制解耦。

这种模式的优点：任务可以中断恢复、多步骤协作、权限隔离。缺点是引入了额外的复杂性——需要理解 session 生命周期、权限传递机制、长时间任务的后台管理。

---

*本文基于 llm-sandbox-deepagents-demo 项目中的集成测试实践整理。*