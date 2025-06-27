// Test script to verify VideoCanvasOverlay loading
// Run this in browser console on the canvas page

console.log('🧪 Testing VideoCanvasOverlay...');

// Test 1: Check if canvas API works
fetch('/api/canvas/xaLHgjjWumgBuEFAhrCSm')
  .then(response => {
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('✅ Canvas API working');
    const elements = data.data?.elements || [];
    const files = data.data?.files || {};
    
    const videoElements = elements.filter(e => e.type === 'video');
    const videoFiles = Object.entries(files).filter(([k, v]) => v.mimeType?.includes('video'));
    
    console.log(`📊 Total elements: ${elements.length}`);
    console.log(`🎬 Video elements: ${videoElements.length}`);
    console.log(`📁 Video files: ${videoFiles.length}`);
    
    if (videoElements.length > 0) {
      console.log('✅ Video elements found:', videoElements);
      
      // Test video file access
      videoElements.forEach((elem, i) => {
        const file = files[elem.fileId];
        const videoUrl = `http://localhost:57988${file?.dataURL}`;
        
        console.log(`🔍 Testing video ${i+1}: ${videoUrl}`);
        
        fetch(videoUrl)
          .then(response => {
            if (response.ok) {
              console.log(`✅ Video ${i+1} accessible (${response.status})`);
            } else {
              console.log(`❌ Video ${i+1} error: ${response.status}`);
            }
          })
          .catch(error => {
            console.log(`❌ Video ${i+1} fetch error:`, error);
          });
      });
    } else {
      console.log('❌ No video elements found');
    }
    
    if (videoFiles.length === 0) {
      console.log('❌ No video files found');
    }
  })
  .catch(error => {
    console.error('❌ Canvas API error:', error);
  });

// Test 2: Check if VideoCanvasOverlay component exists
setTimeout(() => {
  console.log('🔍 Checking for VideoCanvasOverlay component...');
  
  const overlays = document.querySelectorAll('[class*="VideoCanvasOverlay"], [class*="video"], video');
  console.log(`📱 Found ${overlays.length} video-related elements:`, overlays);
  
  // Look for video elements specifically
  const videos = document.querySelectorAll('video');
  console.log(`🎬 Found ${videos.length} video elements:`, videos);
  
  if (videos.length === 0) {
    console.log('❌ No video elements in DOM - VideoCanvasOverlay might not be loading videos');
  } else {
    videos.forEach((video, i) => {
      console.log(`Video ${i+1}: src=${video.src}, size=${video.width}x${video.height}`);
    });
  }
}, 2000);

// Test 3: Check React DevTools for VideoCanvasOverlay
console.log('💡 To debug further:');
console.log('1. Open React DevTools');
console.log('2. Find VideoCanvasOverlay component');
console.log('3. Check its state and props');
console.log('4. Look for any error messages in console');