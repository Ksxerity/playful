const { google } = require('googleapis');
const logger = require('../logger');
const he = require('he');

const max_results = 5;

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YT_API,
});

const searchMusic = async (msg, songTitle) => {
  try {
    let response = await youtube.search.list({
      part: [
        "snippet"
      ],
      type: [
        'video'
      ],
      maxResults: 15, // larger than max results in case we get some live streams in the response
      q: songTitle,
    });
    response = response.data.items;
    return responseBuilder(msg, response);
  } catch (err) {
    logger.log({
      level: 'error',
      message: err.message
    });
  }
};

const responseBuilder = async (msg, response) => {
  let message = "Pick one of the songs to play.\n";
  let durationList = await getDuration(response); // List of contentDetails.
  let limitedList = []; // Top 5 videos that are not live streams
  for (let i = 0; i < response.length; i++) {
    if (limitedList.length === max_results) {
      break;
    }
    let duration = durationList[i].contentDetails.duration; // Ex: PT4M13S
    if (duration === 'P0D') { // Live stream
      // Do nothing because we don't want live streams in list
    } else if (duration.includes('H')) { // Contains hours in duration
      limitedList.push(response[i]) // Add video into list of potential songs to play
      duration = duration.substring(2, duration.length - 1); // Remove PT and S
      duration = duration.replace('H', ',').replace('M', ',');
      duration = duration.split(',');
      if (duration[2].length === 1) {
        duration[2] = `0${duration[2]}`
      }
      message += `${limitedList.length}. ${he.decode(response[i].snippet.title)} (${duration[0]}:${duration[1]}:${duration[2]})\n`;
    } else { // Only contains minutes and seconds
      limitedList.push(response[i])
      duration = duration.substring(2, duration.length - 1); // Remove PT and S
      duration = duration.split('M');
      if (duration[1].length === 1) {
        duration[1] = `0${duration[1]}`
      }
      message += `${limitedList.length}. ${he.decode(response[i].snippet.title)} (${duration[0]}:${duration[1]})\n`;
    }
  }
  msg.channel.send(message);
  return limitedList;
};

const getDuration = async (videoList) => {
  try {
    let idList = []
    for (let i = 0; i < videoList.length; i++) {
      idList.push(videoList[i].id.videoId);
    };
    let response = await youtube.videos.list({
      part: [
        "contentDetails"
      ],
      id: idList,
    });
    return response.data.items;
  } catch (err) {
    logger.log({
      level: 'error',
      message: err.message
    });
  }
};

const addPlaylist = async (playlistUrl) => {
  let playlistId = playlistUrl.split('=');
  playlistId = playlistId[playlistId.length - 1];
  try {
    let response = await youtube.playlistItems.list({
      part: [
        "snippet"
      ],
      playlistId: playlistId,
      maxResults: 50
    });

    let nextPageToken = response.data.nextPageToken;
    let playlistArray = [];
    for (let i = 0; i < response.data.items.length; i++) {
      playlistArray.push(response.data.items[i].snippet.resourceId.videoId);
    }
    while (nextPageToken) {
      let nextPage = await youtube.playlistItems.list({
        part: [
          "snippet"
        ],
        playlistId: playlistId,
        maxResults: 50,
        pageToken: nextPageToken
      });
      nextPageToken = nextPage.data.nextPageToken;
      for (i = 0; i < nextPage.data.items.length; i++) {
        playlistArray.push(nextPage.data.items[i].snippet.resourceId.videoId);
      }
    }
    return playlistArray;
  } catch (err) {
    logger.log({
      level: 'error',
      message: err.message
    });
  }
};

module.exports = {
  searchMusic,
  addPlaylist
}