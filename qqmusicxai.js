"use strict";
const axios = require("axios");
const CryptoJS = require("crypto-js");

const SEARCH_TYPE_MAP = {
  music: 0,
  album: 8,
  artist: 9,
  playlist: 2
};

const guid = () => Math.random().toString(16).substr(2) + Math.random().toString(16).substr(2);

const getUid = () => {
  const t = (new Date).getUTCMilliseconds();
  return "" + Math.round(2147483647 * Math.random()) * t % 1e10
};

const getSign = (params) => {
  const data = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return CryptoJS.MD5(data + "kjNwyqcCBvvu5pP2").toString();
};

async function searchBase(keyword, page, type) {
  const perPage = 30;
  const params = {
    format: "json",
    inCharset: "utf8",
    outCharset: "utf-8",
    notice: 0,
    platform: "yqq.json",
    needNewCode: 0,
    uin: 0,
    g_tk: 5381,
    w: keyword,
    zhidaqu: 1,
    catZhida: 1,
    t: SEARCH_TYPE_MAP[type] || 0,
    flag_qc: 0,
    p: page,
    n: perPage,
    remoteplace: "txt.yqq.center",
    _: Date.now()
  };

  params.sign = getSign(params);

  const res = await axios.get("https://c.y.qq.com/soso/fcgi-bin/client_search_cp", {
    params,
    headers: {
      Referer: "https://y.qq.com/"
    }
  });

  return res.data.data;
}

function formatSong(item) {
  return {
    id: item.songid || item.id,
    mid: item.songmid || item.mid,
    title: item.songname,
    artist: (item.singer || []).map(s => s.name).join('/'),
    album: item.albumname,
    duration: item.interval * 1000,
    artwork: `https://y.qq.com/music/photo_new/T002R300x300M000${item.albummid}.jpg`
  };
}

async function getMediaUrl(song, quality = 'high') {
  const qualityMap = {
    low: { type: 128, format: 'mp3' },
    standard: { type: 320, format: 'mp3' },
    high: { type: 96, format: 'm4a' },
    super: { type: 96, format: 'm4a' }
  };

  const { data } = await axios.get('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    params: {
      format: 'json',
      data: JSON.stringify({
        req_0: {
          module: "vkey.GetVkeyServer",
          method: "CgiGetVkey",
          param: {
            guid: guid(),
            songmid: [song.mid],
            uin: getUid(),
            platform: "20"
          }
        }
      })
    }
  });

  const vkey = data.req_0.data.midurlinfo[0].vkey;
  return `http://ws.stream.qqmusic.qq.com/${song.mid}.${qualityMap[quality].format}?vkey=${vkey}&guid=${guid()}&uin=0&fromtag=8`;
}

module.exports = {
  platform: "QQ音乐",
  version: "0.1.0",
  author: "YourName",
  primaryKey: ["id", "mid"],
  srcUrl: "https://example.com/qqmusic-plugin.js",
  cacheControl: "no-cache",
  supportedSearchType: ["music", "album", "artist", "playlist"],
  
  async search(keyword, page, type) {
    const data = await searchBase(keyword, page, type);
    
    if (type === 'music') {
      return {
        isEnd: data.song.list.length < 30,
        data: data.song.list.map(formatSong)
      };
    }
    
    // 处理其他类型...
  },

  async getMediaSource(song, quality) {
    return {
      url: await getMediaUrl(song, quality)
    };
  },

  async getLyric(song) {
    const { data } = await axios.get('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg', {
      params: {
        format: 'json',
        songmid: song.mid,
        g_tk: 5381
      },
      headers: {
        Referer: 'https://y.qq.com/'
      }
    });
    return {
      lyric: data.lyric ? Buffer.from(data.lyric, 'base64').toString() : ''
    };
  }
};
