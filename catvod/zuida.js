// 最大资源 —— 猫影视(drpy)订阅规则
// 采集站(CMS)源, 与 MoonTV / CMSPlayer 里的同名源一致
// 订阅地址: https://livetv45.ccwu.cc/catvod/zuida.js
var rule = {
    title: '最大资源',
    host: 'https://api.zuidapi.com',
    url: '/api.php/provide/vod?ac=detail&ids=fyid',
    searchUrl: '/api.php/provide/vod?ac=videolist&wd=**',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',
    play_parse: true,
    lazy: '',
    limit: 6,
    double: true,
    推荐: '',
    一级: '',
    二级: '',
    搜索: '',
};
