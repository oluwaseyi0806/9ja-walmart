// ============================================================
// PM2: keeps the shop running forever and restarts it if it crashes or the server reboots.
// Start:  pm2 start deploy/ecosystem.config.js   then   pm2 save
// ============================================================
module.exports = { apps: [{
  name: '9ja-walmart', script: 'server.js', cwd: __dirname + '/..',
  env: { NODE_ENV: 'production', TRUST_PROXY: '1' },
  max_restarts: 20, restart_delay: 3000,
}] };
