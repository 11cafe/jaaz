// Final verification script - run this in browser console
// Go to: http://localhost:5174/canvas/xaLHgjjWumgBuEFAhrCSm

console.log('🧪 Final Video Canvas Verification Test');
console.log('=======================================');

// Test 1: API Data Check
async function testCanvasAPI() {
    console.log('📡 Testing Canvas API...');
    try {
        const response = await fetch(`/api/canvas/xaLHgjjWumgBuEFAhrCSm?t=${Date.now()}`);
        const data = await response.json();
        
        const elements = data.data?.elements || [];
        const files = data.data?.files || {};
        
        const videoElements = elements.filter(e => e.type === 'video');
        const videoFiles = Object.entries(files).filter(([k, v]) => v.mimeType?.includes('video'));
        
        console.log(`✅ API returns ${elements.length} elements`);
        console.log(`🎬 Found ${videoElements.length} video elements`);
        console.log(`📁 Found ${videoFiles.length} video files`);
        
        if (videoElements.length > 0) {
            videoElements.forEach(elem => {
                console.log(`   Video: ${elem.id} at (${elem.x}, ${elem.y})`);
            });
        }
        
        return videoElements.length > 0;
    } catch (error) {
        console.error('❌ API test failed:', error);
        return false;
    }
}

// Test 2: Component State Check
function testComponentState() {
    console.log('🔍 Testing React Component State...');
    
    // Check VideoCanvasOverlay
    const videoElements = document.querySelectorAll('video');
    console.log(`🎬 Found ${videoElements.length} video elements in DOM`);
    
    if (videoElements.length > 0) {
        videoElements.forEach((video, i) => {
            console.log(`   Video ${i+1}: ${video.src}`);
            console.log(`   Size: ${video.width}x${video.height}`);
            console.log(`   Ready state: ${video.readyState}`);
        });
        return true;
    } else {
        console.log('❌ No video elements found in DOM');
        
        // Check if VideoCanvasOverlay exists
        const overlayElements = document.querySelectorAll('[class*="VideoCanvasOverlay"], [class*="absolute"]');
        console.log(`📱 Found ${overlayElements.length} potential overlay elements`);
        
        return false;
    }
}

// Test 3: Direct Video Access
async function testDirectVideoAccess() {
    console.log('🎥 Testing Direct Video Access...');
    try {
        const response = await fetch('/api/file/vid__28Xr6ru.mp4');
        if (response.ok) {
            console.log(`✅ Video file accessible (${response.status})`);
            console.log(`   Content-Type: ${response.headers.get('content-type')}`);
            console.log(`   Content-Length: ${response.headers.get('content-length')}`);
            return true;
        } else {
            console.log(`❌ Video file not accessible (${response.status})`);
            return false;
        }
    } catch (error) {
        console.error('❌ Video access test failed:', error);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Running all tests...\n');
    
    const apiTest = await testCanvasAPI();
    console.log('');
    
    const componentTest = testComponentState();
    console.log('');
    
    const videoTest = await testDirectVideoAccess();
    console.log('');
    
    // Summary
    console.log('📊 TEST RESULTS:');
    console.log(`   API Data: ${apiTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   DOM Video: ${componentTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   File Access: ${videoTest ? '✅ PASS' : '❌ FAIL'}`);
    
    if (apiTest && componentTest && videoTest) {
        console.log('🎉 ALL TESTS PASSED! Video should be working!');
    } else if (apiTest && videoTest && !componentTest) {
        console.log('⚠️  Data is good but video not showing. Try refreshing the page!');
    } else {
        console.log('❌ Some tests failed. Check the issues above.');
    }
}

// Auto-run tests
runAllTests();

// Helper function to force refresh canvas data
window.forceRefreshCanvas = async () => {
    console.log('🔄 Force refreshing canvas...');
    window.location.reload();
};