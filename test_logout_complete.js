// 测试退出登录功能的完整脚本
// 在浏览器控制台中运行，验证cookie清理是否完整

console.log('=== 退出登录前的Cookie状态 ===');
console.log('auth_token:', document.cookie.includes('auth_token'));
console.log('user_uuid:', document.cookie.includes('user_uuid')); 
console.log('user_email:', document.cookie.includes('user_email'));
console.log('jaaz_access_token:', document.cookie.includes('jaaz_access_token'));
console.log('jaaz_user_info:', document.cookie.includes('jaaz_user_info'));

console.log('\n所有cookie:', document.cookie);

// 等待用户点击退出登录
console.log('\n=== 请现在执行退出登录操作 ===');
console.log('退出后页面会自动跳转，等跳转完成后重新打开控制台运行下面的代码：');

console.log(`
// ========== 粘贴到新页面的控制台中 ==========
console.log('=== 退出登录后的Cookie状态 ===');
console.log('auth_token:', document.cookie.includes('auth_token'));
console.log('user_uuid:', document.cookie.includes('user_uuid')); 
console.log('user_email:', document.cookie.includes('user_email'));
console.log('jaaz_access_token:', document.cookie.includes('jaaz_access_token'));
console.log('jaaz_user_info:', document.cookie.includes('jaaz_user_info'));
console.log('\\n所有cookie:', document.cookie);

// 如果还有认证cookie，说明清理失败
const hasAuthCookies = ['auth_token', 'user_uuid', 'user_email', 'jaaz_access_token', 'jaaz_user_info'].some(name => document.cookie.includes(name));
console.log('\\n' + (hasAuthCookies ? '❌ 退出登录失败，仍有认证cookie存在' : '✅ 退出登录成功，所有认证cookie已清理'));
`);