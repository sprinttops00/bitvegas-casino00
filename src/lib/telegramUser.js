export function getCurrentUser() {
  try {
    const tg = window.Telegram?.WebApp
    if (tg?.initDataUnsafe?.user) {
      tg.ready()
      const u = tg.initDataUnsafe.user
      return {
        id: u.id,
        telegram_id: u.id,
        first_name: u.first_name || 'Jugador',
        last_name: u.last_name || null,
        username: u.username || u.first_name || 'Jugador',
        language_code: u.language_code || 'es',
        photo_url: u.photo_url || null,
      }
    }
  } catch (_) {}
  return {
    id: 123456789,
    telegram_id: 123456789,
    first_name: 'DevUser',
    last_name: null,
    username: 'devuser',
    language_code: 'es',
    photo_url: null,
  }
}