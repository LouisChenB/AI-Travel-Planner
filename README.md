## 运行方法（Docker）

- 前置：确保已安装并启动 Docker Desktop。
- 拉取镜像：
    
    docker pull ghcr.io/louischenb/ai-travel-planner:d46e52c003464fbe1cfaa6f53917971df2a6f65d

- 运行容器（将本机 `8080` 端口映射到容器 `80`）：
    
    docker run --rm -p 8080:80 ghcr.io/louischenb/ai-travel-planner:d46e52c003464fbe1cfaa6f53917971df2a6f65d

- 访问应用：在浏览器打开 `http://localhost:8080`
- 如需更换端口，将上面命令中的 `8080` 替换成你需要的本机端口。
