"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const dayjs = require("dayjs");
const he = require("he");
const CryptoJs = require("crypto-js");

const headers = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63",
  accept: "*/*",
  "accept-encoding": "gzip, deflate, br",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
};

const qqMusicApi = "https://c.y.qq.com";

// Function to get QQ Music API response
async function getQQMusicApi(url, params = {}) {
  const res = await axios_1.default.get(url, {
    headers,
    params,
  });
  return res.data;
}

// Function to format duration
function durationToSec(duration) {
  if (typeof duration === "number") {
    return duration;
  }
  if (typeof duration === "string") {
    const dur = duration.split(":");
    return dur.reduce((prev, curr) => 60 * prev + +curr, 0);
  }
  return 0;
}

// Function to format media
function formatMedia(result) {
  return {
    id: result.songmid,
    title: he.decode(result.songname),
    artist: result.singer.map(s => s.name).join(", "),
    album: result.albumname,
    artwork: `https://y.gtimg.cn/music/photo_new/T002/R180x180M000${result.albummid}.jpg`,
    duration: durationToSec(result.interval),
  };
}

// Search function
async function searchBase(keyword, page, type) {
  const params = {
    w: keyword,
    format: "json",
    p: page,
    n: 20,
  };
  let url;
  switch (type) {
    case "music":
      url = `${qqMusicApi}/soso/fcgi-bin/client_search_cp`;
      break;
    case "album":
      url = `${qqMusicApi}/v8/fcg-bin/fcg_v8_album_search.fcg`;
      break;
    case "artist":
      url = `${qqMusicApi}/v8/fcg-bin/fcg_v8_singer_search.fcg`;
      break;
    default:
      return { isEnd: true, data: [] };
  }
  const res = await getQQMusicApi(url, params);
  return res;
}

// Search music
async function searchMusic(keyword, page) {
  const res = await searchBase(keyword, page, "music");
  const data = res.data.song.list.map(formatMedia);
  return {
    isEnd: res.data.song.curpage * res.data.song.curnum >= res.data.song.totalnum,
    data,
  };
}

// Search album
async function searchAlbum(keyword, page) {
  const res = await searchBase(keyword, page, "album");
  const data = res.data.list.map(album => ({
    id: album.albumMID,
    title: album.albumName,
    artwork: `https://y.gtimg.cn/music/photo_new/T002/R180x180M000${album.albumMID}.jpg`,
    artist: album.singerName,
    description: album.desc,
    date: album.releaseDate,
  }));
  return {
    isEnd: res.data.curpage * res.data.perpage >= res.data.totalnum,
    data,
  };
}

// Search artist
async function searchArtist(keyword, page) {
  const res = await searchBase(keyword, page, "artist");
  const data = res.data.list.map(artist => ({
    id: artist.singerMID,
    name: artist.singerName,
    avatar: `https://y.gtimg.cn/music/photo_new/T001/R144x144M000${artist.singerMID}.jpg`,
    worksNum: artist.songNum,
  }));
  return {
    isEnd: res.data.curpage * res.data.perpage >= res.data.totalnum,
    data,
  };
}

// Get media source
async function getMediaSource(musicItem, quality) {
  const params = {
    songmid: musicItem.id,
    filename: `C400${musicItem.id}.m4a`,
    guid: "1234567890",
    platform: "yqq",
    loginflag: 0,
    hostUin: 0,
    needNewCode: 0,
    format: "json",
  };
  const res = await getQQMusicApi(`${qqMusicApi}/base/fcgi-bin/fcg_music_express_mobile3.fcg`, params);
  const file = res.data.items[0];
  const url = `https://dl.stream.qqmusic.qq.com/${file.filename}?vkey=${file.vkey}&guid=${params.guid}&uin=0&fromtag=66`;
  return { url };
}

// Get top lists
async function getTopLists() {
  const res = await getQQMusicApi(`${qqMusicApi}/v8/fcg-bin/fcg_v8_toplist_opt.fcg`, {
    page: "index",
    format: "html",
    tpl: "macv4",
    v: "201509161",
    jsonCallback: "jsonCallback",
  });
  const topLists = res.match(/<li.*?>[\s\S]*?<\/li>/g).map(li => {
    const match = li.match(/<a href="javascript:;" onclick="setStat\((\d+)\);">(.*?)<\/a>/);
    return {
      id: match[1],
      title: match[2],
    };
  });
  return [
    {
      title: "排行榜",
      data: topLists,
    },
  ];
}

// Get top list detail
async function getTopListDetail(topListItem) {
  const res = await getQQMusicApi(`${qqMusicApi}/v8/fcg-bin/fcg_v8_toplist_cp.fcg`, {
    topid: topListItem.id,
    format: "json",
    page: "detail",
    type: "top",
  });
  const musicList = res.songlist.map(song => formatMedia(song.data));
  return {
    ...topListItem,
    musicList,
  };
}

module.exports = {
  platform: "QQ音乐",
  appVersion: ">=0.0",
  version: "0.1.0",
  author: "Your Name",
  cacheControl: "no-cache",
  srcUrl: "https://your-plugin-url.com/qqmusic.js",
  primaryKey: ["id"],
  supportedSearchType: ["music", "album", "artist"],
  async search(keyword, page, type) {
    if (type === "music") {
      return await searchMusic(keyword, page);
    }
    if (type === "album") {
      return await searchAlbum(keyword, page);
    }
    if (type === "artist") {
      return await searchArtist(keyword, page);
    }
  },
  getMediaSource,
  getTopLists,
  getTopListDetail,
};