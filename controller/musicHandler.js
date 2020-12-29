const ytdl = require("ytdl-core");
const api = require("../api");
const logger = require('../logger');

const queue = new Map();
let searchResult;

const vibeHandler = async (msg, songIdentifier) => {
  const voiceChannel = msg.member.voice.channel;
  if (!voiceChannel) {
    msg.reply('You need to be in a voice channel to play music!');
  }

  if (songIdentifier.includes('https://www.youtube.com/watch') || songIdentifier.includes('.ogg')) {
    logger.log({
      level: 'info',
      message: `${msg.member.user.username} played the song ${songIdentifier}`
    });
    playSong(msg, songIdentifier);
  } else if (songIdentifier.includes('https://www.youtube.com/playlist')) {
    logger.log({
      level: 'info',
      message: `${msg.member.user.username} added the playlist ${songIdentifier}`
    });
    const playlistArray = await api.youtubeApi.addPlaylist(songIdentifier);
    for (let i = 0; i < playlistArray.length; i++) {
      await playSong(msg, `https://www.youtube.com/watch?v=${playlistArray[i]}`);
    }
  } else {
    const songNumber = Number(songIdentifier)
    if (searchResult) {
      if (songNumber && songNumber <= 5 && songNumber > 0) {
        logger.log({
          level: 'info',
          message: `${msg.member.user.username} picked the song #${songNumber}: https://www.youtube.com/watch?v=${searchResult[songNumber - 1].id.videoId}`
        });
        playSong(msg, `https://www.youtube.com/watch?v=${searchResult[songNumber - 1].id.videoId}`);
        searchResult = undefined;
        try {
          // Delete bot message that lists search results
          const messages = await msg.channel.messages.fetch({ limit: 25 });
          const itr = messages.keys();
          for (let i = 0; i < 25; i++) {
            const key = itr.next();
            const val = messages.get(key.value);
            if (val.author.bot) {
              if (val.content.includes('Pick one of the songs to play')) {
                val.delete();
                break;
              }
            }
          }
        } catch (err) {
          logger.log({
            level: 'error',
            message: err.message
          });
        }
      } else {
        logger.log({
          level: 'info',
          message: `${msg.member.user.username} requested song title ${songIdentifier}`
        });
        const response = await api.youtubeApi.searchMusic(msg, songIdentifier);
        searchResult = response;
      }
    } else {
      logger.log({
        level: 'info',
        message: `${msg.member.user.username} requested song title ${songIdentifier}`
      });
      const response = await api.youtubeApi.searchMusic(msg, songIdentifier);
      searchResult = response;
    }
  }
}

const playSong = async (msg, songUrl) => {
  const serverQueue = queue.get(msg.guild.id);
  let song;

  if (songUrl.includes('.ogg')) {
    song = {
      title: "Someone's favorite sound! I wonder whose?",
      url: songUrl
    }
  } else {
    try {
      const songInfo = await ytdl.getInfo(songUrl);
      song = {
        title: songInfo.title,
        url: songInfo.video_url,
      }
    } catch (err) {
      logger.log({
        level: 'error',
        message: err.message
      });
      return
    }
  }

  if (!serverQueue) {
    const queueConstruct = {
      textChannel: msg.channel,
      voiceChannel: msg.member.voice.channel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true,
    };
    queue.set(msg.guild.id, queueConstruct);

    queueConstruct.songs.push(song)

    try {
      const connection = await queueConstruct.voiceChannel.join();
      queueConstruct.connection = connection;

      play(msg.guild.id, song);
    } catch (err) {
      logger.log({
        level: 'error',
        message: err.message
      });
      queue.delete(msg.guild.id);
    }
  } else {
    serverQueue.songs.push(song);
  }
};

const play = (id, song) => {
  const serverQueue = queue.get(id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(id);
    return;
  }
  let dispatcher;
  if (song.url.includes('.ogg')) {
    dispatcher = serverQueue.connection.play(song.url)
      .on('finish', () => {
        serverQueue.songs.shift();
        play(id, serverQueue.songs[0]);
      })
      .on('error', (err) => {
        logger.log({
          level: 'error',
          message: err
        });
      });
  } else {
    dispatcher = serverQueue.connection.play(ytdl(song.url, { filter: 'audioonly' }))
      .on('finish', () => {
        serverQueue.songs.shift();
        play(id, serverQueue.songs[0]);
      })
      .on('error', (err) => {
        logger.log({
          level: 'error',
          message: err
        });
      });
  }
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

  serverQueue.textChannel.send(`Playing ${song.title}`);
};

const stopMusic = (msg, humanUser) => {
  if (humanUser) {
    const voiceChannel = msg.member.voice.channel;
    if (!voiceChannel) {
      msg.reply('You need to be in a voice channel to stop music!');
    }
  }

  const serverQueue = queue.get(msg.guild.id);

  if (serverQueue) {
    logger.log({
      level: 'info',
      message: `${msg.member.user.username} stopped the music`
    });
    if (humanUser) { // Human put in the command to stop music
      serverQueue.voiceChannel.leave();
    }
    queue.delete(msg.guild.id);
    return;
  } else {
    logger.log({
      level: 'info',
      message: `${msg.member.user.username} stopped the music, but no queue was available to destroy`
    });
  }
};

const skipSong = (msg) => {
  const voiceChannel = msg.member.voice.channel;
  if (!voiceChannel) {
    msg.reply('You need to be in a voice channel to skip music!');
  }

  logger.log({
    level: 'info',
    message: `${msg.member.user.username} skipped a song`
  });

  const serverQueue = queue.get(msg.guild.id);

  if (serverQueue) {
    serverQueue.connection.dispatcher.end();
  }
};

const pauseMusic = (msg, humanUser) => {
  if (humanUser) {
    const voiceChannel = msg.member.voice.channel;
    if (!voiceChannel) {
      msg.reply('You need to be in a voice channel to pause music!');
    }
  }

  logger.log({
    level: 'info',
    message: `${msg.member.user.username} paused the music`
  });

  const serverQueue = queue.get(msg.guild.id);

  if (serverQueue) {
    serverQueue.connection.dispatcher.pause();
    if (!humanUser) {
      serverQueue.textChannel.send('Aww uwsews have weft the voice channew (TwT) Pauwsing muwsic.')
    }
  }
};

const resumeMusic = (msg) => {
  const voiceChannel = msg.member.voice.channel;
  if (!voiceChannel) {
    msg.reply('You need to be in a voice channel to resume music!');
  }

  logger.log({
    level: 'info',
    message: `${msg.member.user.username} resumed the music`
  });

  const serverQueue = queue.get(msg.guild.id);

  if (serverQueue) {
    serverQueue.connection.dispatcher.resume();
  }
};

module.exports = {
  vibeHandler,
  stopMusic,
  skipSong,
  pauseMusic,
  resumeMusic
}