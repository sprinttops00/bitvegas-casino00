import { supabase } from './supabase'

function generateReferralCode(telegramId) {
  return `REF${telegramId}${Math.random().toString(36).substring(2, 6).toUpperCase()}`
}

// ── USERS ─────────────────────────────────────────────────
export const userDB = {
  async findByTelegramId(telegramId) {
    const { data } = await supabase
      .from('users')
      .select('*, user_statistics(*)')
      .eq('telegram_id', telegramId)
      .single()
    if (data) {
      // Supabase puede devolver user_statistics como array [{...}] o como objeto {...}
      // según cómo detecte la relación. Normalizamos siempre a un objeto único
      // para que total_games_played, total_wins, best_streak, etc. se lean correctamente.
      data.user_statistics = Array.isArray(data.user_statistics)
        ? (data.user_statistics[0] || null)
        : data.user_statistics
    }
    return data
  },

  async create(telegramUser) {
    const { data } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramUser.telegram_id,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        username: telegramUser.username,
        language_code: telegramUser.language_code || 'es',
        photo_url: telegramUser.photo_url,
        tokens: 100,
        points: 0,
        referral_code: generateReferralCode(telegramUser.telegram_id),
        is_new_user: true,
      })
      .select()
      .single()
    if (data) {
      await supabase.from('user_statistics').insert({ user_id: data.id })
    }
    return data
  },

  async update(id, updates) {
    const { data } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    return data
  },

  async listAll(orderBy = 'points', limit = 50) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order(orderBy, { ascending: false })
      .limit(limit)
    return data || []
  },
}

// ── TRANSACTIONS ──────────────────────────────────────────
export const transactionDB = {
  async create({ userId, amount, type, source, balanceAfter }) {
    await supabase.from('transactions').insert({
      user_id: userId,
      amount,
      type,
      source,
      balance_after: balanceAfter,
    })
  },
}

// ── GAME HISTORY ──────────────────────────────────────────
export const gameHistoryDB = {
  async create({ userId, gameType, betAmount, result, winAmount, profit, gameDetails }) {
    await supabase.from('game_history').insert({
      user_id: userId,
      game_type: gameType,
      bet_amount: betAmount,
      result: result || {},
      win_amount: winAmount || 0,
      profit: profit || 0,
      game_details: gameDetails || {},
    })
  },

  async getByUserId(userId, limit = 50) {
    const { data } = await supabase
      .from('game_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return data || []
  },
}

// ── USER STATISTICS ───────────────────────────────────────
export const statsDB = {
  async update(userId, updates) {
    await supabase
      .from('user_statistics')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
  },

  async getByUserId(userId) {
    const { data } = await supabase
      .from('user_statistics')
      .select('*')
      .eq('user_id', userId)
      .single()
    return data
  },

  // Registra una partida terminada y devuelve las estadísticas actualizadas.
  //
  // IMPORTANTE: lee SIEMPRE el estado actual desde la base de datos antes de
  // sumar. Así evitamos el bug por el que, tras la primera partida, los datos
  // en memoria del jugador quedaban vacíos y se sobreescribía el progreso
  // real con valores reiniciados (todo se quedaba "trabado" en 1).
  async recordGame({ userId, won, payout = 0, betAmount = 0 }) {
    const current = (await statsDB.getByUserId(userId)) || {}

    const newStreak = won ? (current.current_streak || 0) + 1 : 0
    const next = {
      total_games_played: (current.total_games_played || 0) + 1,
      total_wins: (current.total_wins || 0) + (won ? 1 : 0),
      total_winnings: (current.total_winnings || 0) + (won ? payout : 0),
      total_losses: (current.total_losses || 0) + (won ? 0 : betAmount),
      biggest_win: Math.max(current.biggest_win || 0, won ? payout : 0),
      current_streak: newStreak,
      best_streak: Math.max(current.best_streak || 0, newStreak),
      updated_at: new Date().toISOString(),
    }

    await statsDB.update(userId, next)
    return next
  },
}

// ── DAILY REWARDS ─────────────────────────────────────────
export const dailyRewardsDB = {
  async claim({ userId, day, rewardAmount }) {
    await supabase.from('daily_rewards').insert({
      user_id: userId,
      day,
      reward_amount: rewardAmount,
    })
  },
}

// ── WITHDRAWALS ───────────────────────────────────────────
export const withdrawalDB = {
  async create({ userId, tokenAmount, tonAmount, walletAddress, status = 'pending' }) {
    const { data } = await supabase
      .from('withdrawals')
      .insert({
        user_id: userId,
        token_amount: tokenAmount,
        ton_amount: tonAmount,
        wallet_address: walletAddress,
        status,
      })
      .select()
      .single()
    return data
  },

  async getByUserId(userId, limit = 10) {
    const { data } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return data || []
  },
}

// ── TASKS ─────────────────────────────────────────────────
export const tasksDB = {
  async getActive() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_active', true)
      .order('order_index')
    return data || []
  },

  async getCompletedByUser(userId) {
    const { data } = await supabase
      .from('user_tasks')
      .select('task_id')
      .eq('user_id', userId)
    return (data || []).map(r => r.task_id)
  },

  async complete({ userId, taskId }) {
    await supabase.from('user_tasks').insert({ user_id: userId, task_id: taskId })
  },
}

// ── ACHIEVEMENTS ──────────────────────────────────────────
export const achievementsDB = {
  async getActive() {
    const { data } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .order('order_index')
    return data || []
  },

  async getUnlockedByUser(userId) {
    const { data } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)
    return (data || []).map(r => r.achievement_id)
  },

  async unlock({ userId, achievementId }) {
    await supabase.from('user_achievements').insert({ user_id: userId, achievement_id: achievementId })
  },
}

// ── SHOP ──────────────────────────────────────────────────
export const shopDB = {
  async recordPurchase({ userId, itemId, price, tokensReceived }) {
    await supabase.from('user_purchases').insert({
      user_id: userId,
      item_id: itemId,
      price,
      tokens_received: tokensReceived,
    })
  },
}

// ── REFERRALS ─────────────────────────────────────────────
export const referralDB = {
  async getByReferrer(referrerId) {
    const { data } = await supabase
      .from('referrals')
      .select('*, users!referrals_referred_id_fkey(username, first_name)')
      .eq('referrer_id', referrerId)
      .order('created_at', { ascending: false })
    return data || []
  },

  async findByCode(code) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', code)
      .single()
    return data
  },
}
