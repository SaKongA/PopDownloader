# 使用官方 Node.js 镜像作为基础镜像
FROM node:18-slim

# 设置工作目录
WORKDIR /usr/src/app

# 复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安装项目依赖
RUN npm install

# 复制整个项目到容器内
COPY . .

# 暴露容器的 3000 端口
EXPOSE 3000

# 设置容器启动时运行的命令
CMD ["npm", "start"]
