const Discord = require("discord.js");
const https = require('https');
const s3 = require('../s3');
const logger = require('../logger');
const config = require('../config.json');

const memeHandler = async (msg, command) => {
  const commandsJSON = await s3.getObject({ Bucket: config.bucket, Key: 'commands.json' }).promise();
  let jsonParse = JSON.parse(commandsJSON.Body);
  command = command.toLowerCase();
  if (jsonParse.memes[command] === undefined) {
    logger.log({
      level: 'info',
      message: `${msg.member.user.username} stored the meme ${command}`
    });
    storeMeme(msg, command, jsonParse);
  } else {
    const url = getProxyUrl(msg);
    if (url) {
      msg.reply('There exists a meme with that name already! Please use another one,');
      return
    }
    logger.log({
      level: 'info',
      message: `${msg.member.user.username} used the meme ${command}`
    });
    const image = await s3.getObject({ Bucket: config.bucket, Key: `assets/${command}` }).promise();
    const attachment = new Discord.MessageAttachment(image.Body);
    msg.delete();
    msg.channel.send(attachment);
  }
};

const storeMeme = (msg, commandName, jsonParse) => {
  const url = getProxyUrl(msg);
  if (!url) {
    msg.reply('No attachment found. If you are trying to store a new image, please include your previous command inside the comment section when uploading the image.')
    return
  }

  let extention = url.split('.');
  extention = extention[extention.length - 1];

  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error('Failed to get image.'));
        return
      }
      let data = [];

      response.on('data', chunk => {
        data.push(chunk);
      }).on('end', () => {
        let buffer = Buffer.concat(data);
        const params = {
          Bucket: config.bucket,
          Key: `assets/${commandName}`,
          Body: buffer
        }
        s3.upload(params, (err) => {
          if (err) {
            logger.log({
              level: 'error',
              message: err
            });
          }
          updateMemesCommandsList(jsonParse, commandName, extention);
          msg.channel.send(`Meme successfully created! Use it by typing in **!meme ${commandName}**`);
        })
      })
      resolve(true);
    });

    request.on('error', err => {
      logger.log({
        level: 'error',
        message: err
      });
      reject(err)
    });

    request.end();
  });
};

const updateMemesCommandsList = (jsonParse, command, extention) => {
  jsonParse.memes[command] = { fileName: `${command}.${extention}` };
  const json = JSON.stringify(jsonParse);
  const params = {
    Bucket: config.bucket,
    Key: 'commands.json',
    Body: json
  }
  s3.upload(params, (err, data) => {
    if (err) {
      console.error(err.message)
    }
    logger.log({
      level: 'info',
      message: `Commands list updated with command: ${command}`
    });
  })
}

const getProxyUrl = (msg) => {
  const itr = msg.attachments.keys();
  const key = itr.next().value;
  if (!key) {
    return 0;
  }
  return msg.attachments.get(key).proxyURL;
}

module.exports = {
  memeHandler,
  storeMeme
}