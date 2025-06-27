// Manual video injection test - Run this in browser console on the canvas page

console.log('🔧 Manual Video Injection Test');
console.log('==============================');

// Function to manually create and inject video element
function injectVideoManually() {
    console.log('📍 Step 1: Looking for canvas container...');
    
    // Find the canvas container
    const canvasContainer = document.querySelector('.excalidraw__canvas') || 
                           document.querySelector('[data-testid="canvas"]') ||
                           document.querySelector('.canvas-container') ||
                           document.querySelector('main') ||
                           document.body;
    
    if (!canvasContainer) {
        console.error('❌ Could not find canvas container');
        return false;
    }
    
    console.log('✅ Found canvas container:', canvasContainer);
    
    // Remove any existing test videos
    const existingTestVideos = document.querySelectorAll('[data-test-video="true"]');
    existingTestVideos.forEach(v => v.remove());
    
    console.log('📍 Step 2: Creating video element...');
    
    // Create video element
    const video = document.createElement('video');
    video.src = '/api/file/vid__28Xr6ru.mp4';
    video.controls = true;
    video.muted = true;
    video.width = 320;
    video.height = 180;
    video.style.position = 'absolute';
    video.style.top = '100px';
    video.style.left = '400px';
    video.style.zIndex = '9999';
    video.style.border = '3px solid red';
    video.style.borderRadius = '8px';
    video.setAttribute('data-test-video', 'true');
    
    // Add event listeners for debugging
    video.addEventListener('loadstart', () => console.log('🎬 Video load started'));
    video.addEventListener('loadedmetadata', () => {
        console.log('✅ Video metadata loaded');
        console.log(`   Duration: ${video.duration}s`);
        console.log(`   Video size: ${video.videoWidth}x${video.videoHeight}`);
    });
    video.addEventListener('loadeddata', () => console.log('✅ Video data loaded'));
    video.addEventListener('canplay', () => console.log('✅ Video can play'));
    video.addEventListener('error', (e) => {
        console.error('❌ Video error:', e);
        console.error('   Error code:', video.error?.code);
        console.error('   Error message:', video.error?.message);
    });
    
    console.log('📍 Step 3: Adding video to DOM...');
    canvasContainer.appendChild(video);
    
    console.log('✅ Video injected! It should appear with a red border.');
    console.log('   Position: (400px, 100px)');
    console.log('   Size: 320x180');
    console.log('   Border: Red (for visibility)');
    
    return true;
}

// Function to test VideoCanvasOverlay component state
function debugVideoCanvasOverlay() {
    console.log('🔍 VideoCanvasOverlay Debug');
    console.log('===========================');
    
    // Try to find React components
    const canvasElements = document.querySelectorAll('[class*="canvas"], [class*="Canvas"]');
    console.log(`Found ${canvasElements.length} canvas-related elements`);
    
    const videoElements = document.querySelectorAll('video');
    console.log(`Found ${videoElements.length} video elements in DOM`);
    
    const overlayElements = document.querySelectorAll('[class*="overlay"], [class*="Overlay"]');
    console.log(`Found ${overlayElements.length} overlay elements`);
    
    // Check for React DevTools
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        console.log('✅ React DevTools available');
        console.log('💡 Open React DevTools and search for "VideoCanvasOverlay" component');
    } else {
        console.log('❌ React DevTools not found');
    }
    
    // Log all elements that might be relevant
    const allElements = document.querySelectorAll('*');
    const videoRelated = Array.from(allElements).filter(el => 
        el.className && (
            el.className.includes('video') ||
            el.className.includes('Video') ||
            el.className.includes('canvas') ||
            el.className.includes('Canvas') ||
            el.className.includes('overlay') ||
            el.className.includes('Overlay')
        )
    );
    
    console.log('🔍 Video/Canvas related elements:', videoRelated.length);
    videoRelated.slice(0, 5).forEach((el, i) => {
        console.log(`   ${i+1}. ${el.tagName} class="${el.className}"`);
    });
}

// Function to test API directly
async function testAPIDirectly() {
    console.log('📡 Testing API Directly');
    console.log('=======================');
    
    try {
        // Test canvas API
        console.log('🔍 Testing canvas API...');
        const canvasResponse = await fetch('/api/canvas/xaLHgjjWumgBuEFAhrCSm');
        const canvasData = await canvasResponse.json();
        
        const videoElements = canvasData.data?.elements?.filter(e => e.type === 'video') || [];
        console.log(`✅ Canvas API returns ${videoElements.length} video elements`);
        
        // Test video file
        console.log('🔍 Testing video file...');
        const videoResponse = await fetch('/api/file/vid__28Xr6ru.mp4');
        console.log(`✅ Video file response: ${videoResponse.status} ${videoResponse.statusText}`);
        
        return true;
    } catch (error) {
        console.error('❌ API test failed:', error);
        return false;
    }
}

// Main debug function
async function runCompleteDebug() {
    console.log('🚀 Running Complete Debug Suite');
    console.log('================================\n');
    
    // Test 1: API
    await testAPIDirectly();
    console.log('');
    
    // Test 2: Component state
    debugVideoCanvasOverlay();
    console.log('');
    
    // Test 3: Manual injection
    const injected = injectVideoManually();
    console.log('');
    
    if (injected) {
        console.log('🎯 NEXT STEPS:');
        console.log('1. Look for the red-bordered video at position (400, 100)');
        console.log('2. If you see it, the issue is with VideoCanvasOverlay component');
        console.log('3. If you don\'t see it, there\'s a deeper video serving issue');
        console.log('4. Open React DevTools and find VideoCanvasOverlay component');
        console.log('5. Check its state and props');
    }
}

// Add helper to remove test video
window.removeTestVideo = () => {
    const testVideos = document.querySelectorAll('[data-test-video="true"]');
    testVideos.forEach(v => v.remove());
    console.log('🗑️ Test video removed');
};

// Run the debug
runCompleteDebug();