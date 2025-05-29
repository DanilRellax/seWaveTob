const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const bot = new TelegramBot('7458341372:AAEIojWlsZIspFgmDkAcgfpeAn4yDIBPcIE', { polling: true });

let users = fs.existsSync('users.json') ? JSON.parse(fs.readFileSync('users.json')) : {};

const saveData = () => fs.writeFileSync('users.json', JSON.stringify(users, null, 2));

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello World!'));
app.listen(process.env.PORT || 3000);

// ==== Работа с БД (пользователями) ====

/** Получить пользователя из базы. Если нет — создать с дефолтными значениями */
function getUser(id, username = '') {
  if (!users[id]) {
    users[id] = {
      stars: 0,
      invited: [],
      username,
      lastDaily: 0,
      inviterId: null, // Добавляем поле для приглашения
    };
    saveData();
  }
  // Обновляем username, если отличается
  if (username && users[id].username !== username) {
    users[id].username = username;
    saveData();
  }
  return users[id];
}

/** Добавить нового реферала */
function addReferral(inviterId, invitedId) {
  const inviter = getUser(inviterId);
  if (!inviter.invited.includes(invitedId)) {
    inviter.stars += 4;
    inviter.invited.push(invitedId);
    saveData();
    bot.sendMessage(inviterId, `🎉 Новый реферал!\nНачислено +4 ⭐️.\n📊 Баланс: ${inviter.stars}`);
  }
}

// ==== Константы и утилиты ====

const ADMINS = [6264259847]; // твой ID
const CHANNELS = ['wave_stars']; // твои каналы без @

const getReferralLink = (id) => `https://t.me/wave_stars_bot?start=${id}`;

async function checkSubscription(userId) {
  for (const channel of CHANNELS) {
    try {
      const member = await bot.getChatMember(`@${channel}`, userId);
      if (['left', 'kicked', 'restricted'].includes(member.status)) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }
  return true;
}

function sendSubscribeMessage(chatId) {
  bot.sendMessage(chatId,
    `🤧 Чтобы использовать бота, подпишись на официальную группу бота!`,
    {
      reply_markup: {
        inline_keyboard: [
          ...CHANNELS.map(channel => [{ text: `Подписаться на канал`, url: `https://t.me/${channel}` }]),
          [{ text: '✅ Проверить подписку', callback_data: 'check_subs' }]
        ]
      }
    }
  );
}

function sendMainMenu(chatId, username) {
  bot.sendMessage(chatId, `👋🏻 Привет, ${username}!

⭐️ Я WaveStars и я раздаю звёзды бесплатно! 
🔥 Приглашай друзей, выполняй задания и обменивай на звёзды!`, {
    reply_markup: {
      keyboard: [
        [{ text: '📓 Профиль' }, { text: '👥 Друзья' }],
        [{ text: '🎮 Игры' }, { text: '🎁 Бонус' }],
        [{ text: '💸 Вывести' }, { text: '🏆 Топ' }],
        ...(ADMINS.includes(Number(chatId)) ? [[{ text: '⚙️ Админка' }]] : [])
      ],
      resize_keyboard: true
    }
  });
}

// ==== Хендлеры ====

bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const username = msg.from.first_name || 'Без имени';

  const user = getUser(chatId, username);

  // Если команда /start с рефералом — сохраняем inviterId, но не добавляем бонус сразу
  if (msg.text && msg.text.startsWith('/start')) {
    const parts = msg.text.split(' ');
    if (parts.length > 1) {
      const inviterId = Number(parts[1]);
      if (inviterId !== chatId) {
        user.inviterId = inviterId;
        saveData();
      }
    }
  }

  // Проверка подписки, если нет - предлогаем подписаться
  if (!(await checkSubscription(chatId))) {
    return sendSubscribeMessage(chatId);
  }

  // Если подписан — показываем главное меню
  if (msg.text && msg.text.startsWith('/start')) {
    sendMainMenu(chatId, username);
    return;
  }

  // Обработка других команд и текста
  if (msg.text) {
    switch (msg.text) {
      case '📓 Профиль': {
        const user = getUser(chatId);
        bot.sendMessage(chatId, `📓 [${msg.from.first_name}](tg://user?id=${msg.from.id}), твой профиль

📊 Баланс: ${user.stars} ⭐️
👥 Приглашено: ${user.invited.length} друзей
🎁 Получено за друзей: ${user.invited.length * 4} ⭐️`, { parse_mode: 'Markdown' });
        break;
      }

      case '👥 Друзья': {
        const user = getUser(chatId);
        const invitedCount = user.invited.length;
        const referralLink = getReferralLink(chatId);
        const shareText = encodeURIComponent(`😎 Я уже получил звёзды! Хочешь тоже? Вот ссылка 👇\n${referralLink}`);
        const quoteText = '😎 Друзья — самый быстрый способ заработать звёзды (⭐️) в боте!\nЗа каждого приглашённого друга ты получишь +4 ⭐️ на свой баланс.\n\n🤫 Вот несколько рабочих способов, как звать больше людей:\n\n✨ Простой способ:\nПопроси друзей, одноклассников или знакомых перейти по твоей ссылке. Чтобы они точно перешли, расскажи пару слов о боте и подарках.\n\nПродвинутый способ:\nПридумай заманчивый текст, например:\n«Кто хочет подарок? Пишите в лс»\nили\n«Кто хочет звёзды? Напишите мне»\nПубликуй такие сообщения в беседах, ЛС или комментариях под постами.\n\n🔥 Для тех, у кого есть аудитория:\nРазмести ссылку в своём канале, беседе, TikTok или других соцсетях. Напиши привлекательный текст, например:\n«Хочешь получить звёзды в Telegram? Смотри в профиле!»\nНе забудь вставить свою реферальную ссылку.\n\n🚀 Будь креативным!\nИспользуй любые методы, даже обмен:\n«Перейди по ссылке — и получишь бонус!»\nЧем оригинальнее — тем лучше результат!';
        const quotedText = `🎁 Приглашай друзей и я буду давать тебе по 4⭐️ за каждого!\n\n🐣 Хочешь знать как приглашать больше друзей? Тапай 👇\n<blockquote expandable>${quoteText}</blockquote>\n🐥 Приглашено: ${invitedCount} друзей\n🍭 Твоя ссылка:\n${referralLink}`;
        bot.sendMessage(chatId, quotedText, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📲 Отправить другу', url: `https://t.me/share/url?url=${shareText}` }]
            ]
          }
        });
        break;
      }

      case '💸 Вывести': {
        const user = getUser(chatId);
        const stars = user.stars;
        const amounts = [50, 100, 350, 500];
        const rows = [];
        for (let i = 0; i < amounts.length; i += 2) {
          rows.push([
            { text: `${amounts[i]} ⭐️`, callback_data: `withdraw_${amounts[i]}` },
            { text: `${amounts[i + 1]} ⭐️`, callback_data: `withdraw_${amounts[i + 1]}` }
          ]);
        }
        bot.sendMessage(chatId, `У тебя ${stars} ⭐️ на балансе\n\nВыбери, сколько хочешь вывести:`, {
          reply_markup: { inline_keyboard: rows }
        });
        break;
      }

      case '🏆 Топ': {
        bot.sendMessage(chatId, 'Выбери тип топа:', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '⭐️ По звёздам', callback_data: 'top_stars' },
                { text: '👥 По приглашениям', callback_data: 'top_invites' }
              ]
            ]
          }
        });
        break;
      }

      case '🎮 Игры': {
        bot.sendMessage(chatId, 'В разработке...');
        break;
      }

      case '🎁 Бонус': {
        const user = getUser(chatId);
        const now = Date.now();

        const BONUS_INTERVAL = 12 * 60 * 60 * 1000;
        const BONUS_DESCRIPTION = "⭐️ Зарабатывай звёзды легко с @wave_stars_bot";

        function formatTime(ms) {
          const h = Math.floor(ms / 3600000).toString().padStart(2, '0');
          const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
          const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
          return `${h} час. ${m} мин. ${s} сек.`;
        }

        if (!user.lastDaily || now - user.lastDaily >= BONUS_INTERVAL) {
          const bonus = 3;
          user.stars += bonus;
          user.lastDaily = now;
          saveData();
          bot.sendMessage(chatId, `🎉 Бонус активирован! Ты получил ${bonus} ⭐️`);
        } else {
          const wait = BONUS_INTERVAL - (now - user.lastDaily);
          bot.sendMessage(chatId, `⏳ Следующий бонус можно получить через ${formatTime(wait)}`);
        }
        break;
      }

      /* ---АДМИН-ПАНЕЛЬ--- */
      case '⚙️ Админка': {
        if (!ADMINS.includes(msg.from.id)) return;

        bot.sendMessage(chatId, '⚙️ Панель администратора', {
          reply_markup: {
            keyboard: [
              [{ text: '📤 Рассылка' }],
              [{ text: '📊 Статистика' }],
              [{ text: '⬅️ Назад' }]
            ],
            resize_keyboard: true
          }
        });
        break;
      }

      case '⬅️ Назад': {
        sendMainMenu(chatId, user.username);
        break;
      }

      case '📤 Рассылка': {
        if (!ADMINS.includes(msg.from.id)) return;

        bot.sendMessage(chatId, '✍️ Введи текст рассылки (HTML разрешён):', {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [[{ text: '❌ Отмена' }]],
            resize_keyboard: true
          }
        });

        users[chatId].awaitingBroadcastText = true;
        break;
      }
      case '📊 Статистика': {
        if (!ADMINS.includes(msg.from.id)) return;

        const totalUsers = Object.keys(users).length;
        const totalStars = Object.values(users).reduce((acc, u) => acc + (u.stars || 0), 0);
        const totalInvites = Object.values(users).reduce((acc, u) => acc + (u.invited?.length || 0), 0);
        const active24h = Object.values(users).filter(u => Date.now() - (u.lastDaily || 0) <= 24 * 60 * 60 * 1000).length;
        const bonusClaimed = Object.values(users).filter(u => u.lastDaily).length;

        bot.sendMessage(chatId, `
📊 <b>Статистика бота</b>:

👥 Пользователей: <b>${totalUsers}</b>
⭐️ Всего звёзд: <b>${totalStars}</b>
🤝 Приглашений: <b>${totalInvites}</b>

🕒 Активны за 24ч: <b>${active24h}</b>
🎁 Получили бонус хотя бы раз: <b>${bonusClaimed}</b>
        `.trim(), { parse_mode: 'HTML' });

        break;
      }


      default:
        ///////////////

        if (msg.text === '❌ Отмена') {
          if (!ADMINS.includes(msg.from.id)) return;
          users[chatId].awaitingBroadcastText = false;
          users[chatId].awaitingBroadcastConfirm = false;
          users[chatId].broadcast = null;
          sendMainMenu(chatId, user.username);
          return;
        }

        if (users[chatId].awaitingBroadcastText) {
          users[chatId].awaitingBroadcastText = false;
          users[chatId].broadcast = { text: msg.text };

          bot.sendMessage(chatId, msg.text, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🚀 Отправить', callback_data: 'confirm_broadcast' },
                { text: '❌ Отмена', callback_data: 'cancel_broadcast' }
              ]]
            }
          });

          users[chatId].awaitingBroadcastConfirm = true;
          return;
        }

        bot.sendMessage(chatId, `Команда не найдена, используй кнопки:`, {
          reply_markup: {
            keyboard: [
              [{ text: '📓 Профиль' }, { text: '👥 Друзья' }],
              [{ text: '🎮 Игры' }, { text: '🎁 Бонус' }],
              [{ text: '💸 Вывести' }, { text: '🏆 Топ' }],
              ...(ADMINS.includes(Number(chatId)) ? [[{ text: '⚙️ Админка' }]] : [])
            ],
            resize_keyboard: true
          }
        });
        break;
    }

  }


});


// Каллбек

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id.toString();
  const user = getUser(chatId);


  // ADMINKA
  if (query.data === 'cancel_broadcast') {
    users[chatId].awaitingBroadcastConfirm = false;
    users[chatId].broadcast = null;
    bot.editMessageText('❌ Рассылка отменена.', {
      chat_id: chatId,
      message_id: query.message.message_id
    });
    sendMainMenu(chatId, user.username);
    return;
  }

  if (query.data === 'confirm_broadcast') {
    const broadcast = users[chatId].broadcast;
    if (!broadcast) return;

    let sent = 0;
    let noSent = 0;
    for (const id in users) {
      try {
        await bot.sendMessage(id, broadcast.text, { parse_mode: 'HTML' });
        sent++;
      } catch (e) { noSent++ }
    }

    bot.editMessageText(`✅ Рассылка отправлена ${sent} (❌ ${noSent}) пользователям.`, {
      chat_id: chatId,
      message_id: query.message.message_id
    });

    users[chatId].awaitingBroadcastConfirm = false;
    users[chatId].broadcast = null;
    sendMainMenu(chatId, user.username);
  }


  if (query.data === 'check_subs') {

    bot.deleteMessage(query.message.chat.id, query.message.message_id);
    if (await checkSubscription(chatId)) {
      // Если подписан — добавляем рефералку если есть inviterId и реферал ещё не добавлен
      if (user.inviterId && users[user.inviterId] && !users[user.inviterId].invited.includes(chatId)) {
        addReferral(user.inviterId, chatId);
        delete user.inviterId; // удаляем, чтобы не добавлять повторно
        saveData();
      }
      sendMainMenu(chatId, user.username);
    } else {
      bot.answerCallbackQuery(query.id, '❌ Без подписки доступ к боту закрыт.', true);
      sendSubscribeMessage(chatId);
    }
  }

  if (query.data.startsWith('withdraw_')) {
    const amount = parseInt(query.data.split('_')[1], 10);
    if (user.stars >= amount) {
      user.stars -= amount;
      saveData();
      bot.sendMessage(chatId, `✅ Заявка на вывод ${amount} ⭐️ отправлена!\n👌 Обычно это занимает от 5 минут до 24 часов!`);
    } else {
      return bot.answerCallbackQuery(
        query.id,
        `❗️Недостаточно ⭐️ для вывода!\n✖️ Тебе не хватает ${amount - user.stars} ⭐️`,
        true
      );
    }
  }

  if (query.data === 'top_stars' || query.data === 'top_invites') {
    const escapeHTML = (text) =>
      String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const formatUsernameHTML = (user, id) => {
      let name = user.username;
      name = name.replace(/^@+/, '');
      name = escapeHTML(name);
      return name;
    };

    const topType = query.data === 'top_stars' ? 'stars' : 'invited';

    // Общий массив всех пользователей для сортировки
    const fullTop = [];

    for (const id in users) {
      const user = users[id];
      const value = topType === 'stars' ? user.stars : (user.invited?.length || 0);
      if (typeof value !== 'number') continue;

      fullTop.push({ id, user, value });
    }

    // Сортируем общий список по убыванию
    fullTop.sort((a, b) => b.value - a.value);

    // Определяем позицию текущего пользователя
    const currentUserIndex = fullTop.findIndex(entry => entry.id === chatId);
    const currentUserPosition = currentUserIndex >= 0 ? currentUserIndex + 1 : null;

    // Отбираем топ 10
    const top10 = fullTop.slice(0, 10);

    // Заголовок
    let title =
      topType === 'stars'
        ? '🏆 <b>Топ по звёздам:</b>\n\n'
        : '🏆 <b>Топ по приглашениям:</b>\n\n';
    // Заголовок №2
    let titleType =
      topType === 'stars'
        ? '<b>заработал</b>'
        : '<b>пригласил</b>';

    // Тело топа
    let text = top10.reduce((acc, entry, i) => {
      const { id, user, value } = entry;
      const suffix = topType === 'stars' ? '⭐️' : 'друзей';
      return acc + `${i + 1}. ${formatUsernameHTML(user, id)}: ${titleType} ${value} ${suffix}\n`;
    }, title);

    // Добавляем позицию пользователя в общем списке
    if (currentUserPosition) {
      text += `\n📍 Ты находишься на <b>${currentUserPosition}</b> месте`;
    } else {
      return;
    }

    return bot.editMessageText(text,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: "HTML",
        disable_notification: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⭐️ По звёздам', callback_data: 'top_stars' },
              { text: '👥 По приглашениям', callback_data: 'top_invites' }
            ]
          ]
        },
      },
    );
  }

});

// Запуск бота
console.log('Bot started...');

