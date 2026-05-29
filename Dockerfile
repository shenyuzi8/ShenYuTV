# ---- 第 1 阶段：安装依赖 ----
FROM node:20-alpine AS deps

WORKDIR /app

# 【关键】设置阿里云 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com/

# 复制依赖清单
COPY package.json package-lock.yaml ./

# 安装依赖（npm 版本）
RUN npm install

# ---- 第 2 阶段：构建项目 ----
FROM node:20-alpine AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
# 复制全部源代码
COPY . .

# 环境变量
ENV DOCKER_ENV=true

# 构建项目（npm run build）
RUN npm run build

# ---- 第 3 阶段：生成运行时镜像 ----
FROM node:20-alpine AS runner

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DOCKER_ENV=true

# 从构建器中复制文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/start.js ./start.js
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非特权用户
USER nextjs

EXPOSE 3000

# 启动方式：使用 node 运行 start.js
CMD ["node", "start.js"]