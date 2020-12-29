require('dotenv').config();
const Discord = require("discord.js");
const config = require("./config.json");
const controller = require("./controller");
const logger = require("./logger");
let bot = new Discord.Client();

bot.on('ready', () => {
  logger.log({
    level: 'info',
    message: 'Discord Server is running...'
  });
})

bot.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.channel !== null) { // Person leaves
    if (!controller.util.humanUserExists(oldState)) { // No humans in voice channel
      if (oldState.channel.members.size === 0) { // if bot was last to leave, destroy queue
        controller.musicHandler.stopMusic(oldState, false);
      } else { // If human leaves with bot still inside
        controller.musicHandler.pauseMusic(oldState, false);
      }
      // oldState.channel.leave();
    } else { // Bot leaves the voice channel with humans still inside
      const isBot = oldState.member.user.bot;
      if (isBot) {
        controller.musicHandler.stopMusic(oldState, false);
      }
    }
  }
});

bot.on('message', async (msg) => {
  if (msg.author.bot) {
    return;
  }
  if (msg.content.includes('eyelid') && msg.content.includes('tenor')) {
    logger.log({
      level: 'error',
      message: `${msg.member.user.username} attempted to post a forbidden gif`
    });
    msg.delete();
    msg.reply('Please don\'t post that specific gif in here...');
  }
  if (msg.content.startsWith(config.prefix)) {
    const args = msg.content.substring(config.prefix.length).split(/ +/);
    let command;
    const postfix = args.shift().toLowerCase();
    switch (postfix) {
      case 'help':
        logger.log({
          level: 'info',
          message: `${msg.member.user.username} requested the help information`
        });
        msg.delete();
        msg.reply(await controller.util.helpMessage());
        break;
      case 'meme':
        if (args.length === 0) {
          msg.reply('Please include a command. i.e. "!meme cry"');
          break;
        }
        command = args.shift();
        controller.imageHandler.memeHandler(msg, command);
        break;
      case 'mc':
        if (args.length === 1) {
          const sound = args.shift();
          if (sound === 'bell') {
            controller.musicHandler.vibeHandler(msg, './sounds/bell.ogg');
          }
          break;
        } else {
          msg.reply('The only command available now is "!mc bell"');
          break;
        }
      case 'play':
        if (args.length === 0) {
          controller.musicHandler.vibeHandler(msg, 'https://www.youtube.com/watch?v=jhvUqV3qeC0&ab_channel=OliviaTatara');
          break;
        }
        song = msg.content.substring(5); // removes '!play ' from command
        controller.musicHandler.vibeHandler(msg, song);
        break;
      case 'stop':
        controller.musicHandler.stopMusic(msg, true);
        break;
      case 'skip':
        controller.musicHandler.skipSong(msg);
        break;
      case 'pause':
        controller.musicHandler.pauseMusic(msg, true);
        break;
      case 'resume':
        controller.musicHandler.resumeMusic(msg);
        break;
      case 'note':
        if (args.length === 0) {
          msg.reply('Please include an entry.');
          break;
        }
        let entry = msg.content.substring(5);
        controller.journalHandler.journalEntry(msg, entry);
        break;
    }
  }
})

bot.login(process.env.DISCORD_TOKEN);