module.exports = {
  apps: [
    {
      name: "chartize",
      cwd: "/home/dialup/chartize/apps/web/.next/standalone",
      script: "apps/web/server.js",
      interpreter:
        "/home/dialup/.local/share/fnm/node-versions/v24.13.0/installation/bin/node",
      node_args: ["--env-file=/home/dialup/chartize/.env"],
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3002",
        CHARTIZE_DATA_ROOT: "/home/dialup/chartize/data",
      },
      autorestart: true,
      kill_timeout: 30000,
      max_memory_restart: "1G",
      time: true,
    },
  ],
};
