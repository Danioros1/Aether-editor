const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

console.log('🎬 Testing FFmpeg Worker Setup...\n');

// Test 1: Check FFmpeg installation
console.log('1. Testing FFmpeg installation...');
console.log(`   FFmpeg path: ${ffmpegPath.path}`);

// Test 2: Check if FFmpeg binary works
ffmpeg.getAvailableFormats((err, formats) => {
  if (err) {
    console.error('❌ FFmpeg test failed:', err.message);
    process.exit(1);
  }
  
  console.log('✅ FFmpeg is working correctly');
  console.log(`   Available formats: ${Object.keys(formats).length}`);
  
  // Test 3: Check directories
  console.log('\n2. Testing directory structure...');
  
  const uploadsDir = path.join(__dirname, 'uploads');
  const downloadsDir = path.join(__dirname, 'downloads');
  
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads directory');
  } else {
    console.log('✅ Uploads directory exists');
  }
  
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
    console.log('✅ Created downloads directory');
  } else {
    console.log('✅ Downloads directory exists');
  }
  
  console.log('\n🎉 Worker setup test completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Install and start Redis server');
  console.log('2. Run "npm run dev:all" to start both API and Worker');
  console.log('3. Test the render endpoint with a sample project');
});