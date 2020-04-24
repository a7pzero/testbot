import dlVars = require('./download_tools/vars');
import constants = require('./.constants');
import http = require('http');
import ariaTools = require('./download_tools/aria-tools');
import TelegramBot = require('node-telegram-bot-api');

export async function deleteMsg (bot:TelegramBot, msg:TelegramBot.Message, delay?:number) {
  if (delay) await sleep(delay);

  bot.deleteMessage(msg.chat.id, msg.message_id.toString())
    .catch(ignored => {});
}

export function sleep (ms:number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isAuthorized (msg:TelegramBot.Message, dlDetails?:dlVars.DlVars) {
  for (var i = 0; i < constants.SUDO_USERS.length; i++) {
    if (constants.SUDO_USERS[i] === msg.from.id) return 0;
  }
  if (dlDetails && dlDetails.isDownloading && msg.from.id === dlDetails.tgFromId) return 1;
  if (constants.AUTHORIZED_CHATS.indexOf(msg.chat.id) > -1 &&
    msg.chat.all_members_are_administrators) return 2;
  if (constants.AUTHORIZED_CHATS.indexOf(msg.chat.id) > -1) return 3;
  return -1;
}

export function isAdmin (bot:TelegramBot, msg:TelegramBot.Message, callback:(err:string,isAdmin:boolean)=>void) {
  bot.getChatAdministrators(msg.chat.id)
    .then(members => {
      for (var i = 0; i < members.length; i++) {
        if (members[i].user.id === msg.from.id) {
          callback(null, true);
          return;
        }
      }
      callback(null, false);
    })
    .catch(() => {
      callback(null, false);
    });
}

/**
 * Notifies an external webserver once a download is complete.
 * @param {boolean} successful True is the download completed successfully
 * @param {string} gid The GID of the downloaded file
 * @param {number} originGroup The Telegram chat ID of the group where the download started
 * @param {string} driveURL The URL of the uploaded file
 */
export function notifyExternal (successful:boolean, gid:string, originGroup:number, driveURL?:string) {
  if (!constants.DOWNLOAD_NOTIFY_TARGET || !constants.DOWNLOAD_NOTIFY_TARGET.enabled) return;
  ariaTools.getStatus(gid, (err, message, filename, filesize) => {
    var name;
    var size;
    if (!err) {
      if (filename !== 'Metadata') name = filename;
      if (filesize !== '0B') size = filesize;
    }

    // TODO: Check which vars are undefined and make those null
    const data = JSON.stringify({
      successful: successful,
      file: {
        name: name,
        driveURL: driveURL,
        size: size
      },
      originGroup: originGroup
    });

    const options = {
      host: constants.DOWNLOAD_NOTIFY_TARGET.host,
      port: constants.DOWNLOAD_NOTIFY_TARGET.port,
      path: constants.DOWNLOAD_NOTIFY_TARGET.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    var req = http.request(options);
    req.on('error', (e) => {
      console.error(`notifyExternal failed: ${e.message}`);
    });
    req.write(data);
    req.end();
  });
}
