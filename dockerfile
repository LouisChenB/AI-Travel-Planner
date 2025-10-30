# 依赖阶段：构建前端
FROM node:20-alpine AS build
WORKDIR /app

# 仅复制包清单以利用缓存
COPY package*.json ./
RUN npm ci

# 复制源代码并构建
COPY . .
# 可选：传入 Vite 构建期环境变量（如 Supabase）
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
RUN npm run build

# 运行阶段：用 Nginx 托管静态文件
FROM nginx:alpine
# 拷贝构建产物
COPY --from=build /app/dist /usr/share/nginx/html
# 可选：自定义 Nginx 配置（如需要前端路由 fallback）
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]