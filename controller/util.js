const s3 = require('../s3');
const config = require('../config.json');
const itemSpaces = '     ';

const helpMessage = async () => {
  let msg = 'Hello! Seems like you need a little help. Look to the commands below for guidance!\n\n';
  msg += `memes: command usage **!meme *command***\n${itemSpaces}- `;

  const commandsJSON = await s3.getObject({ Bucket: config.bucket, Key: 'commands.json' }).promise();
  let jsonParse = JSON.parse(commandsJSON.Body);
  Object.keys(jsonParse.memes).forEach((element) => {
    msg += `${element}, `
  });
  msg = msg.substring(0, msg.length - 2);
  msg += '\n\n';

  msg += `music: command usage **!*command* *(song)***\n${itemSpaces}`;
  Object.keys(jsonParse.music).forEach((element) => {
    msg += `${element}  -  ${jsonParse.music[element].description}\n${itemSpaces}`
  });
  msg += '\n';

  msg += `note: command usage **!*note* *entry***\n${itemSpaces}`;
  msg += `- ${jsonParse.note.description}\n${itemSpaces}`
  return msg;
};

const humanUserExists = (voiceState) => {
  let botCount = 0;
  voiceState.channel.members.forEach((element) => {
    if (element.user.bot) {
      botCount++;
    }
  });
  if (voiceState.channel.members.size === botCount) {
    return false;
  } else {
    return true;
  }
};

module.exports = {
  helpMessage,
  humanUserExists
}