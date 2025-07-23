# Test script for render endpoint using PowerShell

$BaseUrl = "http://localhost:3001"

Write-Host "🧪 Testing render endpoint..." -ForegroundColor Cyan

# Test valid request
Write-Host "📤 Sending valid render request..." -ForegroundColor Yellow

$ValidRequestBody = @{
    projectData = @{
        projectSettings = @{
            name = "Test Project"
            resolution = "1080p"
            fps = 30
            duration = 10
        }
        assetLibrary = @(
            @{
                assetId = "asset-1"
                fileName = "test-image.jpg"
                type = "image"
                sourceUrl = "http://localhost:3001/uploads/test-image.jpg"
                duration = 5
            }
        )
        timeline = @{
            videoTracks = @(
                @(
                    @{
                        clipId = "clip-1"
                        assetId = "asset-1"
                        startTime = 0
                        duration = 5
                        volume = 1
                    }
                )
            )
            audioTracks = @()
        }
        selectedClipId = $null
        currentTime = 0
        isPlaying = $false
        timelineScale = 50
    }
    exportSettings = @{
        resolution = "1080p"
        format = "mp4"
    }
} | ConvertTo-Json -Depth 10

try {
    $Response = Invoke-RestMethod -Uri "$BaseUrl/api/render" -Method Post -Body $ValidRequestBody -ContentType "application/json" -StatusCodeVariable StatusCode
    
    Write-Host "📊 HTTP Status: $StatusCode" -ForegroundColor Green
    Write-Host "📋 Response Body:" -ForegroundColor Green
    $Response | ConvertTo-Json -Depth 5
    
    if ($StatusCode -eq 202 -and $Response.success -and $Response.jobId) {
        Write-Host "✅ Valid request test PASSED" -ForegroundColor Green
        Write-Host "🆔 Job ID: $($Response.jobId)" -ForegroundColor Cyan
        
        # Test job status endpoint
        Write-Host "📤 Testing job status endpoint..." -ForegroundColor Yellow
        
        try {
            $StatusResponse = Invoke-RestMethod -Uri "$BaseUrl/api/render/status/$($Response.jobId)" -Method Get -StatusCodeVariable StatusStatusCode
            
            Write-Host "📊 Status HTTP Status: $StatusStatusCode" -ForegroundColor Green
            Write-Host "📋 Status Response Body:" -ForegroundColor Green
            $StatusResponse | ConvertTo-Json -Depth 5
            
            if ($StatusStatusCode -eq 200 -and $StatusResponse.success) {
                Write-Host "✅ Job status test PASSED" -ForegroundColor Green
            } else {
                Write-Host "❌ Job status test FAILED" -ForegroundColor Red
            }
        } catch {
            Write-Host "❌ Job status test FAILED: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Valid request test FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Valid request test FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🧪 Testing invalid request..." -ForegroundColor Cyan

# Test invalid request
$InvalidRequestBody = @{
    invalid = "data"
} | ConvertTo-Json

try {
    $InvalidResponse = Invoke-RestMethod -Uri "$BaseUrl/api/render" -Method Post -Body $InvalidRequestBody -ContentType "application/json" -StatusCodeVariable InvalidStatusCode
    Write-Host "❌ Invalid request test FAILED - Should have returned error" -ForegroundColor Red
} catch {
    $ErrorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "📊 Invalid HTTP Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Green
    Write-Host "📋 Invalid Response Body:" -ForegroundColor Green
    $ErrorDetails | ConvertTo-Json -Depth 3
    
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "✅ Invalid request test PASSED" -ForegroundColor Green
    } else {
        Write-Host "❌ Invalid request test FAILED" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ All tests completed!" -ForegroundColor Green