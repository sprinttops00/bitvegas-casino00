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

// ── BOOSTS & INVENTORY ────────────────────────────────────
export const boostDB = {
  async getActiveByUser(userId) {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('user_boosts')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', now)
      .order('expires_at', { ascending: true })
    return data || []
  },

  async add({ userId, boostType, multiplier = 1, durationHours = 24 }) {
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString()
    const { data } = await supabase
      .from('user_boosts')
      .insert({
        user_id: userId,
        boost_type: boostType,
        multiplier,
        expires_at: expiresAt,
      })
      .select()
      .single()
    return data
  },

  async consume(boostId) {
    await supabase.from('user_boosts').delete().eq('id', boostId)
  },

  // Procesa automáticamente los potenciadores activos en cada partida de juego
    async processGameBoosts({ userId, won, betAmount, basePayout, basePoints }) {
    try {
      const activeBoosts = await boostDB.getActiveByUser(userId)

      let finalPayout = basePayout
      let finalPoints = basePoints
      let shieldUsed = false
      let boostBonusTokens = 0

      if (activeBoosts && activeBoosts.length > 0) {
        // 1. Escudo Anti-Pérdida si perdió. Se prioriza el ESCUDO DIARIO (no se
        // consume, protege todas las pérdidas durante 24h) sobre el de un solo uso.
        if (!won && betAmount > 0) {
          const dailyShield = activeBoosts.find(b => b.boost_type === 'shield_daily')
          const singleShield = activeBoosts.find(b => b.boost_type === 'shield')
          if (dailyShield) {
            finalPayout = betAmount // Reembolsa la apuesta completa (NO se consume, dura 24h)
            shieldUsed = true
          } else if (singleShield) {
            finalPayout = betAmount // Reembolsa la apuesta completa
            shieldUsed = true
            await boostDB.consume(singleShield.id) // Consume el escudo (1 solo uso)
          }
        }

        // 2. Multiplicadores de ganancia en victoria (Amuleto / Amuleto Legendario / VIP Pass)
        if (won) {
          const netProfit = Math.max(0, basePayout - betAmount)
          const legendaryBoost = activeBoosts.find(b => b.boost_type === 'lucky_charm_legendary')
          const luckyBoost = activeBoosts.find(b => b.boost_type === 'lucky_charm')
          const vipBoost = activeBoosts.find(b => b.boost_type === 'vip_pass')

          let winBonusRate = 0
          // El Amuleto Legendario (+30%) y el normal (+15%) no se suman entre sí:
          // se usa el más fuerte que tengas activo. El VIP siempre suma aparte.
          if (legendaryBoost) winBonusRate += 0.30
          else if (luckyBoost) winBonusRate += 0.15
          if (vipBoost) winBonusRate += 0.10 // +10% extra

          if (winBonusRate > 0) {
            boostBonusTokens = Math.floor(netProfit * winBonusRate)
            finalPayout += boostBonusTokens
          }
        }

        // 3. Multiplicadores de Puntos de Ranking (Double PTS / VIP Pass)
        const hasDoublePts = activeBoosts.some(b => b.boost_type === 'double_pts' || b.boost_type === 'vip_pass')
        if (hasDoublePts) {
          finalPoints = finalPoints * 2
        }
      }

      return {
        finalPayout,
        finalPoints,
        shieldUsed,
        boostBonusTokens,
        activeBoosts,
      }
    } catch (err) {
      console.warn('Error aplicando potenciadores:', err)
      return {
        finalPayout: basePayout,
        finalPoints: basePoints,
        shieldUsed: false,
        boostBonusTokens: 0,
        activeBoosts: [],
      }
    }
  },

// ── JACKPOT SEMANAL DEL RANKING ──────────────────────────────
export const jackpotDB = {
  async getCurrent() {
    const { data } = await supabase.from('casino_jackpot').select('amount').eq('id', 1).single()
    return data?.amount || 0
  },

  // Suma tokens perdidos al jackpot (llamar solo cuando el jugador pierde de verdad,
  // es decir, cuando NO se activó un escudo anti-pérdida).
  async addToPot(amount) {
    if (!amount || amount <= 0) return
    await supabase.rpc('increment_jackpot', { amount_to_add: amount })
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
