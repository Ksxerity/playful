const config = require('../config.json');
const s3 = require('../s3');
const logger = require('../logger');

const journalEntry = async (msg, entry) => {
  logger.log({
    level: 'info',
    message: `${msg.member.user.username} added a journal entry: ${entry}`
  });
  const dateObj = new Date();
  const date = `${dateObj.getMonth() + 1}-${dateObj.getDate()}-${dateObj.getFullYear()}`;
  const time = `${dateObj.getHours()}:${dateObj.getMinutes()}:${dateObj.getSeconds()}`;

  let name = msg.author.username.toLowerCase();
  name = config.discord_usernames[name] ? config.discord_usernames[name] : name;
  let jsonParse;
  try {
    const journalEntry = await s3.getObject({ Bucket: config.bucket, Key: `journals/${name}.json` }).promise();
    jsonParse = JSON.parse(journalEntry.Body);
    if (jsonParse[date]) { // If date exists
      if (jsonParse[date][time]) { // If date and time exists
        jsonParse[date][time] = `${jsonParse[date][time]} ${entry}`;
      } else { // If only date exists
        jsonParse[date][time] = entry;
      }
    } else { // If no date exists
      jsonParse[date] = { [time]: entry };
    }
  } catch (err) {
    jsonParse = {};
    jsonParse[date] = { [time]: entry };
  }
  const json = JSON.stringify(jsonParse);
  try {
    const params = {
      Bucket: config.bucket,
      Key: `journals/${name}.json`,
      Body: json
    }
    s3.upload(params, (err, data) => {
      if (err) {
        logger.log({
          level: 'error',
          message: `Journal file upload failed. - ${err.message}`
        });
      }
      logger.log({
        level: 'info',
        message: `${name}'s journal updated with entry: ${entry}`
      });
    })
    msg.reply('Note successfully entered.')
  } catch (err) {
    logger.log({
      level: 'error',
      message: `Can't write file ${name}.json - ${err.message}`
    });
  }
};

module.exports = {
  journalEntry
}