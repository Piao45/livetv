# 直播 · Live TV

一个在线直播电视页面：打开即看，无需登录。

- 频道源：Guovin/iptv-api 的 IPv4 M3U（每日更新），页面运行时从 jsDelivr 实时拉取
- 播放：hls.js（Chrome 等）/ Safari 原生 HLS；一个频道多个源，播不了自动换源，也可手动点“换个源”
- 分组浏览 + 搜索；手机、电视浏览器均可使用
- 中转代理：`api/proxy.js`（Vercel Serverless Function）。免费央视频道源基本都是 http://，浏览器在 https 页面上会拦截混合内容，所以所有视频流都经本站 `/api/proxy?url=...` 走 https 中转；函数会跟随上游重定向、把 m3u8 清单里的相对分片地址也改写成经代理的绝对地址，分片以流式透传。无鉴权、无登录。注意：视频流量全部走 Vercel（免费档每月 100 GB），约合 70 小时左右的观看量。

部署：把本仓库部署到 Vercel 即可，无需构建、无需环境变量；`api/` 目录会被自动识别为 Serverless Function。
