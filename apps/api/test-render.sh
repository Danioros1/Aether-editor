#!/bin/bash

# Test script for render endpoint using curl

BASE_URL="http://localhost:3001"

echo "🧪 Testing render endpoint..."

# Test valid request
echo "📤 Sending valid render request..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "projectData": {
      "projectSettings": {
        "name": "Test Project",
        "resolution": "1080p",
        "fps": 30,
        "duration": 10
      },
      "assetLibrary": [
        {
          "assetId": "asset-1",
          "fileName": "test-image.jpg",
          "type": "image",
          "sourceUrl": "http://localhost:3001/uploads/test-image.jpg",
          "duration": 5
        }
      ],
      "timeline": {
        "videoTracks": [
          [
            {
              "clipId": "clip-1",
              "assetId": "asset-1",
              "startTime": 0,
              "duration": 5,
              "volume": 1
            }
          ]
        ],
        "audioTracks": []
      },
      "selectedClipId": null,
      "currentTime": 0,
      "isPlaying": false,
      "timelineScale": 50
    },
    "exportSettings": {
      "resolution": "1080p",
      "format": "mp4"
    }
  }' \
  "$BASE_URL/api/render")

# Extract HTTP status and body
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
HTTP_BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

echo "📊 HTTP Status: $HTTP_STATUS"
echo "📋 Response Body: $HTTP_BODY"

if [ "$HTTP_STATUS" -eq 202 ]; then
    echo "✅ Valid request test PASSED"
    
    # Extract job ID for status test
    JOB_ID=$(echo $HTTP_BODY | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
    
    if [ ! -z "$JOB_ID" ]; then
        echo "🆔 Job ID: $JOB_ID"
        
        # Test job status endpoint
        echo "📤 Testing job status endpoint..."
        STATUS_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
          "$BASE_URL/api/render/status/$JOB_ID")
        
        STATUS_HTTP_STATUS=$(echo $STATUS_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
        STATUS_HTTP_BODY=$(echo $STATUS_RESPONSE | sed -e 's/HTTPSTATUS:.*//g')
        
        echo "📊 Status HTTP Status: $STATUS_HTTP_STATUS"
        echo "📋 Status Response Body: $STATUS_HTTP_BODY"
        
        if [ "$STATUS_HTTP_STATUS" -eq 200 ]; then
            echo "✅ Job status test PASSED"
        else
            echo "❌ Job status test FAILED"
        fi
    fi
else
    echo "❌ Valid request test FAILED"
fi

echo ""
echo "🧪 Testing invalid request..."

# Test invalid request
INVALID_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}' \
  "$BASE_URL/api/render")

INVALID_HTTP_STATUS=$(echo $INVALID_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
INVALID_HTTP_BODY=$(echo $INVALID_RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

echo "📊 Invalid HTTP Status: $INVALID_HTTP_STATUS"
echo "📋 Invalid Response Body: $INVALID_HTTP_BODY"

if [ "$INVALID_HTTP_STATUS" -eq 400 ]; then
    echo "✅ Invalid request test PASSED"
else
    echo "❌ Invalid request test FAILED"
fi

echo ""
echo "✅ All tests completed!"