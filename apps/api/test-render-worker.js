const { Queue } = require('bullmq');
const Redis = require('ioredis');
const path = require('path');
const fs = require('fs');

// Test configuration
const redisConfig = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true
};

// Sample project data for testing
const sampleProjectData = {
  projectSettings: {
    name: "Test Project",
    resolution: "1080p",
    fps: 30,
    duration: 10
  },
  assetLibrary: [
    {
      assetId: "test-asset-1",
      fileName: "test-image.jpg",
      type: "image",
      sourceUrl: "http://localhost:3001/uploads/test-image.jpg",
      duration: 5
    }
  ],
  timeline: {
    videoTracks: [
      [
        {
          clipId: "test-clip-1",
          assetId: "test-asset-1",
          startTime: 0,
          duration: 5,
          volume: 1,
          animation: {
            type: "ken_burns",
            startRect: { x: 0, y: 0, scale: 1 },
            endRect: { x: 100, y: 100, scale: 1.2 }
          }
        }
      ]
    ],
    audioTracks: []
  },
  selectedClipId: null,
  currentTime: 0,
  isPlaying: false,
  timelineScale: 50
};

const sampleExportSettings = {
  resolution: "1080p",
  format: "mp4"
};

async function testWorker() {
  console.log('🧪 Testing FFmpeg Render Worker...\n');

  try {
    // Test Redis connection
    console.log('1. Testing Redis connection...');
    const redis = new Redis(redisConfig);
    
    await redis.ping();
    console.log('✅ Redis connection successful');

    // Create render queue
    const renderQueue = new Queue('video-render', {
      connection: redis,
    });

    console.log('✅ BullMQ queue created');

    // Test job creation
    console.log('\n2. Testing job creation...');
    const jobId = `test-render-${Date.now()}`;
    
    const renderJobData = {
      projectData: sampleProjectData,
      exportSettings: sampleExportSettings,
      jobId,
      createdAt: new Date().toISOString(),
      status: 'queued'
    };

    const job = await renderQueue.add('render-video', renderJobData, {
      jobId,
      priority: 1,
      delay: 0
    });

    console.log(`✅ Test job created: ${jobId}`);

    // Monitor job progress
    console.log('\n3. Monitoring job progress...');
    console.log('   (Make sure the worker is running with "npm run dev:worker")');
    
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (!jobCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const updatedJob = await renderQueue.getJob(jobId);
      if (updatedJob) {
        const state = await updatedJob.getState();
        const progress = updatedJob.progress;
        
        console.log(`   Job ${jobId}: ${state} (${JSON.stringify(progress)})`);
        
        if (state === 'completed') {
          console.log('✅ Job completed successfully!');
          console.log('   Result:', updatedJob.returnvalue);
          jobCompleted = true;
        } else if (state === 'failed') {
          console.log('❌ Job failed:', updatedJob.failedReason);
          jobCompleted = true;
        }
      }
      
      attempts++;
    }

    if (!jobCompleted) {
      console.log('⏰ Job monitoring timed out. Check worker logs for details.');
    }

    // Cleanup
    await renderQueue.close();
    await redis.quit();
    
    console.log('\n🎉 Worker test completed!');

  } catch (error) {
    console.error('❌ Worker test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure Redis server is running:');
      console.log('   - Windows: Download from https://redis.io/download');
      console.log('   - macOS: brew install redis && brew services start redis');
      console.log('   - Linux: sudo systemctl start redis');
    }
    
    process.exit(1);
  }
}

// Create a simple test image if it doesn't exist
function createTestAsset() {
  const uploadsDir = path.join(__dirname, 'uploads');
  const testImagePath = path.join(uploadsDir, 'test-image.jpg');
  
  if (!fs.existsSync(testImagePath)) {
    console.log('📝 Creating test image...');
    
    // Create a simple colored rectangle as test image using FFmpeg
    const ffmpeg = require('fluent-ffmpeg');
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegPath.path);
    
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input('color=red:size=1920x1080:duration=1')
        .inputFormat('lavfi')
        .output(testImagePath)
        .on('end', () => {
          console.log('✅ Test image created');
          resolve();
        })
        .on('error', (err) => {
          console.log('⚠️  Could not create test image, but test can continue');
          resolve(); // Continue anyway
        })
        .run();
    });
  } else {
    console.log('✅ Test image already exists');
    return Promise.resolve();
  }
}

// Run the test
async function runTest() {
  console.log('🚀 Starting Worker Test Suite...\n');
  
  try {
    await createTestAsset();
    await testWorker();
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  runTest();
}

module.exports = { testWorker, createTestAsset };