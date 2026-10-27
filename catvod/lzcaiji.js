// 量子资源 —— 猫影视 Node.js 订阅包
// 采集站(CMS)源, 与 MoonTV / CMSPlayer 里的同名源一致
// 订阅地址: https://livetv45.ccwu.cc/catvod/lzcaiji.js
// 订阅目录: https://livetv45.ccwu.cc/catvod/ (自动读取 index.js)
let siteName = '量子资源';
let API = 'https://cj.lzcaiji.com/api.php/provide/vod';
let UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function init(cfg) {
}

function safeJSONParse(str, defaultValue) {
    if (!str) return defaultValue;
    if (typeof str === 'object') return str;
    try {
        return JSON.parse(str);
    } catch (e) {
        return defaultValue;
    }
}

async function request(url) {
    try {
        if (typeof req !== 'undefined') {
            const response = await req(url, {
                method: 'GET',
                headers: { 'User-Agent': UA },
                timeout: 15000
            });
            return response?.content || response?.data || response;
        }
    } catch (e) {}
    try {
        if (typeof fetch !== 'undefined') {
            const r = await fetch(url, { headers: { 'User-Agent': UA } });
            return await r.text();
        }
    } catch (e) {}
    return null;
}

function toVod(v) {
    return {
        vod_id: String(v.vod_id),
        vod_name: v.vod_name || '',
        vod_pic: v.vod_pic || '',
        vod_remarks: v.vod_remarks || '',
        type_name: v.type_name || ''
    };
}

function toVodDetail(v) {
    return {
        vod_id: String(v.vod_id),
        vod_name: v.vod_name || '',
        vod_pic: v.vod_pic || '',
        type_name: v.type_name || '',
        vod_year: v.vod_year || '',
        vod_area: v.vod_area || '',
        vod_remarks: v.vod_remarks || '',
        vod_actor: v.vod_actor || '',
        vod_director: v.vod_director || '',
        vod_content: String(v.vod_content || '').replace(/<[^>]+>/g, ''),
        vod_play_from: v.vod_play_from || '',
        vod_play_url: v.vod_play_url || ''
    };
}

async function home(filter) {
    let classes = [];
    let list = [];
    const data = safeJSONParse(await request(API + '?ac=list'), {});
    if (data && Array.isArray(data.class)) {
        for (const c of data.class) {
            if (c.type_pid !== 0 && c.type_pid !== '0') {
                classes.push({ type_id: String(c.type_id), type_name: c.type_name });
            }
        }
        if (!classes.length) {
            for (const c of data.class) {
                classes.push({ type_id: String(c.type_id), type_name: c.type_name });
            }
        }
    }
    if (!classes.length) {
        classes = [
            { type_id: '1', type_name: '电影' },
            { type_id: '2', type_name: '电视剧' },
            { type_id: '3', type_name: '综艺' },
            { type_id: '4', type_name: '动漫' }
        ];
    }
    if (data && Array.isArray(data.list)) list = data.list.map(toVod);
    return JSON.stringify({ class: classes, list: list });
}

async function homeVod() {
    const data = safeJSONParse(await request(API + '?ac=videolist&pg=1'), {});
    let list = [];
    if (data && Array.isArray(data.list)) list = data.list.map(toVod);
    return JSON.stringify({ list: list });
}

async function category(tid, pg, filter, extend) {
    pg = pg || 1;
    if (extend && extend['1']) tid = extend['1'];
    const data = safeJSONParse(await request(API + '?ac=videolist&t=' + encodeURIComponent(tid) + '&pg=' + pg), {});
    let list = [];
    if (data && Array.isArray(data.list)) list = data.list.map(toVod);
    return JSON.stringify({
        page: parseInt(data.page || pg),
        pagecount: parseInt(data.pagecount || 1),
        limit: parseInt(data.limit || 20),
        total: parseInt(data.total || 0),
        list: list
    });
}

async function detail(id) {
    const data = safeJSONParse(await request(API + '?ac=detail&ids=' + encodeURIComponent(id)), {});
    let list = [];
    if (data && Array.isArray(data.list) && data.list.length) list = [toVodDetail(data.list[0])];
    return JSON.stringify({ list: list });
}

async function search(wd, quick, pg) {
    pg = pg || 1;
    const data = safeJSONParse(await request(API + '?ac=videolist&wd=' + encodeURIComponent(wd) + '&pg=' + pg), {});
    let list = [];
    if (data && Array.isArray(data.list)) list = data.list.map(toVod);
    return JSON.stringify({
        page: parseInt(data.page || pg),
        pagecount: parseInt(data.pagecount || 1),
        limit: parseInt(data.limit || 20),
        total: parseInt(data.total || 0),
        list: list
    });
}

function isVideoUrl(url) {
    return /\.(m3u8|mp4|mkv|flv|mp3|m4a|aac|mpd)(\?|#|$)/i.test(url);
}

async function play(flag, id, flags) {
    const url = String(id || '').trim();
    if (!url) return JSON.stringify({ parse: 0, url: '' });
    if (isVideoUrl(url)) {
        return JSON.stringify({ parse: 0, url: url, header: { 'User-Agent': UA } });
    }
    return JSON.stringify({ parse: 1, url: url, header: { 'User-Agent': UA } });
}

export function __jsEvalReturn() {
    return {
        init: init,
        home: home,
        homeVod: homeVod,
        category: category,
        detail: detail,
        play: play,
        search: search
    };
}
