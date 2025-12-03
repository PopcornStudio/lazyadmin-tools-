require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const pty = require('node-pty');
const os = require('os');

const TOKEN = process.env.TELEGRAM_TOKEN;
const ALLOWED_USER_ID = parseInt(process.env.ALLOWED_USER_ID, 10);

if (!TOKEN || !ALLOWED_USER_ID) {
  console.error('Error: Set TELEGRAM_TOKEN and ALLOWED_USER_ID in .env');
  process.exit(1);
}

const MAX_MESSAGE_LENGTH = 3500;
const FLUSH_INTERVAL = 120;
const MAX_BUFFER_CHARS = 500_000;

const bot = new TelegramBot(TOKEN, { polling: true });

const terms = new Map();
const buffers = new Map();
const timers = new Map();
const lastMsgIds = new Map();

const escapeHtml = text =>
  text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

const cleanOutput = data =>
  data
    .replace(/\u001b\]0;.*?(\u0007|\u001b\\)/g, '')
    .replace(/\u0007/g, '')
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, s => /[m]$/.test(s) ? s : '')
    .replace(/\u001b\[[0-9;]*\?.*?[A-Za-z]/g, '')
    .replace(/\u001b\[[0-3]?[JK]/g, '')
    .replace(/\u001b\[2J\u001b\[H|\u001b\[2J/g, '\n\n--- Screen cleared ---\n\n')
    .replace(/\r(?!\n)/g, '\n')
    .replace(/(\[sudo\] password for [^:]+:).*/g, '$1 ••••••••')
    .replace(/((?:[\w\-]+@\w+:[^$\n]*\$)\s*)\1+/g, '$1');

bot.onText(/\/start/, msg => {
  if (msg.from.id !== ALLOWED_USER_ID) return;
  bot.sendMessage(msg.chat.id, 'Remote shell ready.\nSend any command.');
});

bot.on('message', async msg => {
  if (!msg.text || msg.from.id !== ALLOWED_USER_ID || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  let term = terms.get(chatId);

  if (!term) {
    term = pty.spawn('bash', ['-i'], {
      name: 'xterm-256color',
      cols: 96,
      rows: 30,
      cwd: os.homedir(),
      env: process.env
    });

    terms.set(chatId, term);
    buffers.set(chatId, '');
    lastMsgIds.set(chatId, null);

    await bot.sendMessage(chatId, 'Terminal session started…');

    term.on('data', data => {
      const cleaned = cleanOutput(data);
      if (!cleaned) return;

      let buf = (buffers.get(chatId) || '') + cleaned;

      if (buf.length > MAX_BUFFER_CHARS) {
        buf = '[output truncated]\n' + buf.slice(-Math.floor(MAX_BUFFER_CHARS * 0.9));
      }

      buffers.set(chatId, buf);
      clearTimeout(timers.get(chatId));
      timers.set(chatId, setTimeout(() => flushBuffer(chatId), FLUSH_INTERVAL));
    });

    term.on('exit', () => {
      flushBuffer(chatId);
      bot.sendMessage(chatId, '*Session terminated*', { parse_mode: 'Markdown' });
      cleanup(chatId);
    });
  }

  term.write(msg.text + '\r');
});

function flushBuffer(chatId) {
  let text = buffers.get(chatId) || '';
  if (!text.trim() && text.length < 10) {
    buffers.set(chatId, '');
    return;
  }

  let remaining = text;
  while (remaining.length > MAX_MESSAGE_LENGTH) {
    sendOrEdit(chatId, remaining.slice(0, MAX_MESSAGE_LENGTH));
    remaining = remaining.slice(MAX_MESSAGE_LENGTH);
  }
  if (remaining.trim()) sendOrEdit(chatId, remaining);
  buffers.set(chatId, '');
}

async function sendOrEdit(chatId, text) {
  const formatted = `<pre>${escapeHtml(text)}</pre>`;
  const msgId = lastMsgIds.get(chatId);

  try {
    if (msgId && text.length < 1000) {
      await bot.editMessageText(formatted, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'HTML'
      });
    } else {
      const sent = await bot.sendMessage(chatId, formatted, { parse_mode: 'HTML' });
      lastMsgIds.set(chatId, sent.message_id);
    }
  } catch (e) {
    const sent = await bot.sendMessage(chatId, formatted, { parse_mode: 'HTML' });
    lastMsgIds.set(chatId, sent.message_id);
  }
}

function cleanup(chatId) {
  terms.get(chatId)?.kill();
  terms.delete(chatId);
  buffers.delete(chatId);
  timers.delete(chatId);
  lastMsgIds.delete(chatId);
}

console.log('Telegram Shell Bot is running • Waiting for commands...');
