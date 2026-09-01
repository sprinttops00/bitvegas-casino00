import { supabase } from './supabase'
import { CONFIG } from './config'
import { transactionDB, userDB } from './db'

export async function creditUser(userId, amount, source, currentBalance) {
  const newBalance = currentBalance + amount
  await userDB.update(userId, { tokens: newBalance })
  await transactionDB.create({ userId, amount, type: 'credit', source, balanceAfter: newBalance })
  return newBalance
}

export async function debitUser(userId, amount, source, currentBalance) {
  const newBalance = currentBalance - amount
  await userDB.update(userId, { tokens: newBalance })
  await transactionDB.create({ userId, amount, type: 'debit', source, balanceAfter: newBalance })
  return newBalance
}

export async function processPurchase({ userId, tonPaid, tokensToCredit, currentBalance }) {
  const devShare = tonPaid * CONFIG.DEV_SHARE
  const bankRetains = tonPaid - devShare
  const newBalance = await creditUser(userId, tokensToCredit, 'token_purchase', currentBalance)
  await supabase.from('transactions').insert({
    user_id: userId,
    amount: tokensToCredit,
    type: 'credit',
    source: `fin_purchase__ton:${tonPaid.toFixed(6)}__dev:${devShare.toFixed(6)}__bank:${bankRetains.toFixed(6)}`,
    balance_after: newBalance,
  })
  return { newBalance, devShare, bankRetains }
}

// Ahora recibe también los puntos actuales del jugador (totales y de la semana)
// para poder acreditarle puntos además de tokens por ver el anuncio.
export async function processAdReward({ userId, currentBalance, currentPoints = 0, currentWeeklyPoints = 0, adsgramPayment = 0.001 }) {
  const devShare = adsgramPayment * CONFIG.DEV_SHARE
  const bankRetains = adsgramPayment - devShare
  const tokensEarned = CONFIG.TOKENS_PER_AD
  const pointsEarned = CONFIG.POINTS_PER_AD
  const newBalance = currentBalance + tokensEarned

  const updatedPlayer = await userDB.update(userId, {
    tokens: newBalance,
    points: currentPoints + pointsEarned,
    weekly_points: currentWeeklyPoints + pointsEarned,
  })

  await transactionDB.create({ userId, amount: tokensEarned, type: 'credit', source: 'ad_reward', balanceAfter: newBalance })

  return { newBalance, tokensEarned, pointsEarned, updatedPlayer }
}

export async function processExpressWithdrawalAds({ userId, adsgramPayment = 0.002 }) {
  const devShare = adsgramPayment * CONFIG.DEV_SHARE_ADS
  const bankRetains = adsgramPayment - devShare
  await supabase.from('transactions').insert({
    user_id: userId,
    amount: 0,
    type: 'debit',
    source: `fin_express_withdrawal__ton:${adsgramPayment}__dev:${devShare.toFixed(6)}__bank:${bankRetains.toFixed(6)}`,
    balance_after: 0,
  })
  return { devShare, bankRetains }
}
