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

export async function processAdReward({ userId, currentBalance, adsgramPayment = 0.001 }) {
  const devShare = adsgramPayment * CONFIG.DEV_SHARE
  const bankRetains = adsgramPayment - devShare
  const newBalance = await creditUser(userId, CONFIG.TOKENS_PER_AD, 'ad_reward', currentBalance)
  return { newBalance, tokensEarned: CONFIG.TOKENS_PER_AD }
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