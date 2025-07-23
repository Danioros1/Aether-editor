const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Aether Editor API and Worker...\n');

// Start API server
const apiProcess = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// Start worker
const workerProcess = spawn('npm', ['run', 'dev:worker'], {
  cwd: __dirname,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// Handle API server output
apiProcess.stdout.on('data', (data) => {
  console.log(`[API] ${data.toString().trim()}`);
});

apiProcess.stderr.on('data', (data) => {
  console.error(`[API ERROR] ${data.toString().trim()}`);
});

// Handle worker output
workerProcess.stdout.on('data', (data) => {
  console.log(`[WORKER] ${data.toString().trim()}`);
});

workerProcess.stderr.on('data', (data) => {
  console.error(`[WORKER ERROR] ${data.toString().trim()}`);
});

// Handle process exits
apiProcess.on('close', (code) => {
  console.log(`\n❌ API server exited with code ${code}`);
  workerProcess.kill();
  process.exit(code);
});

workerProcess.on('close', (code) => {
  console.log(`\n❌ Worker exited with code ${code}`);
  apiProcess.kill();
  process.exit(code);
});

// Handle shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down API and Worker...');
  apiProcess.kill();
  workerProcess.kill();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('✅ Both API server and Worker are starting...');
console.log('📋 Press Ctrl+C to stop both processes\n');