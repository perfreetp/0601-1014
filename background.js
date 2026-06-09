console.log('直播视觉物料生成器 background service worker 已加载');

chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已成功安装');
});
