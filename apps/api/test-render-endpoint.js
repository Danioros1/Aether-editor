// Simple test script to validate the render endpoint
const fetch = require('node-fetch');

const testRenderEndpoint = async () => {
  const baseUrl = 'http://localhost:3001';
  
  // Test data that matches the expected schema
  const testProject = {
    projectData: {
      projectSettings: {
        name: "Test Project",
        resolution: "1080p",
        fps: 30,
        duration: 10
      },
      assetLibrary: [
        {
          assetId: "asset-1",
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
              clipId: "clip-1",
              assetId: "asset-1",
              startTime: 0,
              duration: 5,
              volume: 1
            }
          ]
        ],
        audioTracks: []
      },
      selectedClipId: null,
      currentTime: 0,
      isPlaying: false,
      timelineScale: 50
    },
    exportSettings: {
      resolution: "1080p",
      format: "mp4"
    }
  };

  try {
    console.log('🧪 Testing render endpoint...');
    
    const response = await fetch(`${baseUrl}/api/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testProject)
    });

    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Body:', JSON.stringify(result, null, 2));
    
    if (response.status === 202 && result.success && result.jobId) {
      console.log('✅ Render endpoint test PASSED');
      console.log('🆔 Job ID:', result.jobId);
      
      // Test job status endpoint
      console.log('\n🧪 Testing job status endpoint...');
      const statusResponse = await fetch(`${baseUrl}/api/render/status/${result.jobId}`);
      const statusResult = await statusResponse.json();
      
      console.log('📊 Status Response:', statusResponse.status);
      console.log('📋 Status Body:', JSON.stringify(statusResult, null, 2));
      
      if (statusResponse.status === 200 && statusResult.success) {
        console.log('✅ Job status endpoint test PASSED');
      } else {
        console.log('❌ Job status endpoint test FAILED');
      }
    } else {
      console.log('❌ Render endpoint test FAILED');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
};

// Test invalid request
const testInvalidRequest = async () => {
  const baseUrl = 'http://localhost:3001';
  
  try {
    console.log('\n🧪 Testing invalid request handling...');
    
    const response = await fetch(`${baseUrl}/api/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ invalid: 'data' })
    });

    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Body:', JSON.stringify(result, null, 2));
    
    if (response.status === 400 && result.error) {
      console.log('✅ Invalid request handling test PASSED');
    } else {
      console.log('❌ Invalid request handling test FAILED');
    }
    
  } catch (error) {
    console.error('❌ Invalid request test failed:', error.message);
  }
};

// Run tests
const runTests = async () => {
  console.log('🚀 Starting render endpoint tests...\n');
  
  // Wait a moment for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testRenderEndpoint();
  await testInvalidRequest();
  
  console.log('\n✅ All tests completed!');
};

runTests();