# Antifraud Analyst Agent — Render-ready

Эта версия подготовлена специально для Render Web Service.

## Render настройки

- Language: Node
- Branch: main
- Root Directory: пусто
- Build Command: `npm install`
- Start Command: `npm start`
- Instance Type: Free

## Что работает

- Главная страница: `index.html`
- API анализа URL: `/api/analyze-url`
- Сервер: `server.js`

# Агент антифрод-аналитика — repaired

Исправлена критическая ошибка, из-за которой кнопки не работали.

## Причина

Внутри демонстрационного JavaScript-примера был сырой HTML-текст `</script>`.
Браузер воспринимал его как закрытие основного script-блока, даже если он находился внутри template string.
Из-за этого ломался весь JavaScript интерфейса.

## Исправление

Демо-теги script разбиты безопасно: `<scr` + `ipt>`.
Теперь основной JavaScript не прерывается.

## Проверка

- JS-синтаксис проверен через Node.
- onclick-функции проверены.
- getElementById проверены.
- вкладки и панели проверены.
