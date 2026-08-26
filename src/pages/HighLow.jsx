import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB, boostDB, jackpotDB } from '@/lib/db'
import { getBoostNotifications } from '@/lib/boostNotify'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import GameHeader from '@/components/GameHeader'
import BoostAlert from '@/components/BoostAlert'

const MAX_NUM = 11

const INFO = [
  '🔢 Se muestra un número del 1 al 10. Adivina si el siguiente será mayor, menor o igual.',
  '📈 Mayor o Menor: ganas x2.',
  '🎯 Igual: ganas x7.',
  '🔥 Racha de 3+: bono extra del 50%.',
]

function getRandomNumber() { return Math.floor(Math.random() * MAX_NUM) + 1 }

export default function HighLow() {
  const [player, setPlayer] = useState(null)
  const [currentNumber, setCurrentNumber] = useState(null)
  const [nextNumber, setNextNumber] = useState(null)
  const [betAmount, setBetAmount] = useState(100)
  const [guessing, setGuessing] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [streak, setStreak] = useState(0)
  const [boostQueue, setBoostQueue] = useState([])

  useEffect(() => { loadPlayer(); setCurrentNumber(getRandomNumber()) }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  const guess = async (choice) => {
    if (!player || guessing || betAmount > player.tokens) return
    setGuessing(true)
    setOutcome(null)
    const currentPlayer = player

    // 1. Descontamos la apuesta del saldo de inmediato, antes de la animación.
    const afterBet = currentPlayer.tokens - betAmount
    const deducted = await userDB.update(currentPlayer.id, { tokens: afterBet })
    setPlayer(deducted)

    const next = getRandomNumber()
    setNextNumber(next)
    await new Promise(r => setTimeout(r, 600))

    const displayNext = Math.min(next, 10)
    let won = false
    if (choice === 'higher') won = next > currentNumber
    else if (choice === 'lower') won = next < currentNumber
    else if (choice === 'equal') won = next === currentNumber

    const newStreak = won ? streak + 1 : 0
    const streakBonus = won && newStreak >= 3 ? Math.floor(betAmount * 0.5) : 0
    const basePayout = won ? (choice === 'equal' ? betAmount * 7 : Math.floor(betAmount * 2)) : 0
    const totalBasePayout = basePayout + streakBonus
    const basePoints = won ? 25 : 3

    // 2. Aplicamos los potenciadores activos del inventario.
    const boostResult = await boostDB.processGameBoosts({
      userId: currentPlayer.id,
      won,
      betAmount,
      basePayout: totalBasePayout,
      basePoints,
    })

    // 3. Acreditamos el resultado final (ganancia, o reembolso si el escudo se activó).
    const finalTokens = afterBet + boostResult.finalPayout

    setStreak(newStreak)
    setOutcome({ won, payout: totalBasePayout, next: displayNext, choice, streakBonus })

    const updated = await userDB.update(currentPlayer.id, {
      tokens: finalTokens,
      points: (currentPlayer.points || 0) + boostResult.finalPoints,
      weekly_points: (currentPlayer.weekly_points || 0) + boostResult.finalPoints,
    })
    setPlayer(updated)

    if (!won && !boostResult.shieldUsed) {
        await jackpotDB.addToPot(betAmount)
      }

    // 4. Mostramos el aviso de potenciador si aplicó alguno.
    const notifications = getBoostNotifications({ boostResult, betAmount, basePoints })
    if (notifications.length > 0) setBoostQueue(notifications)

    await gameHistoryDB.create({
      userId: currentPlayer.id,
      gameType: 'highlow',
      betAmount,
      result: { next: displayNext, choice },
      winAmount: won ? boostResult.finalPayout : (boostResult.shieldUsed ? betAmount : 0),
      profit: boostResult.finalPayout - betAmount,
      gameDetails: { choice, streakBonus, boostApplied: boostResult.shieldUsed || boostResult.boostBonusTokens > 0 },
    })

    await statsDB.recordGame({
      userId: currentPlayer.id,
      won,
      payout: totalBasePayout,
      betAmount: boostResult.shieldUsed ? 0 : betAmount,
    })

    setTimeout(() => { setCurrentNumber(displayNext); setNextNumber(null); setGuessing(false) }, 1500)
  }

  const changeBet = (d) => setBetAmount(p => Math.max(10, Math.min(player?.tokens||0, p+d)))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #1a0e05 0%, #0d0704 100%)' }}>
      <GameHeader title="HIGH / LOW" balance={player?.tokens} infoTitle="Cómo jugar High/Low" infoContent={INFO} />
      <BoostAlert
        notification={boostQueue[0] || null}
        onClose={() => setBoostQueue(prev => prev.slice(1))}
      />
      <div className="flex justify-center items-center gap-6 py-4">
        <motion.div key={currentNumber} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-2xl flex items-center justify-center"
          style={{ background: 'radial-gradient(circle at 35% 30%, #fde68a, #d4a017 50%, #9a6f00)', boxShadow: '0 0 30px rgba(212,160,23,0.5)' }}>
          <span className="text-5xl font-black text-yellow-900">{currentNumber}</span>
        </motion.div>
        <div className="text-primary/40 text-2xl font-black">→</div>
        <div className="w-24 h-24 rounded-2xl flex items-center justify-center"
          style={{
            background: nextNumber !== null ? (outcome?.won ? 'radial-gradient(circle,#22c55e,#15803d)' : 'radial-gradient(circle,#dc2626,#991b1b)') : 'rgba(255,255,255,0.05)',
            border: nextNumber !== null ? (outcome?.won ? '2px solid rgba(34,197,94,0.5)' : '2px solid rgba(220,38,38,0.4)') : '2px solid rgba(255,255,255,0.1)',
          }}>
          {nextNumber !== null
            ? <span className="text-5xl font-black text-white">{nextNumber}</span>
            : <span className={`text-3xl ${guessing?'animate-pulse':'text-muted-foreground'}`}>?</span>}
        </div>
      </div>
      <div className="px-4 mb-2 h-8 flex items-center justify-center">
        <AnimatePresence>
          {outcome && !guessing && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`px-6 py-1 rounded-full text-sm font-bold ${outcome.won ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {outcome.won ? `🎉 +${outcome.payout.toLocaleString()} TOKENS` : `😔 -${betAmount.toLocaleString()} TOKENS`}
              {outcome.streakBonus > 0 && ` (+${outcome.streakBonus} racha)`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="px-3 flex-1">
        <div className="rounded-2xl overflow-hidden" style={{
          background: 'linear-gradient(180deg, #1a6b2e 0%, #145923 100%)',
          border: '3px solid #8B6914', boxShadow: '0 0 0 2px #d4a017',
        }}>
          <div className="text-center pt-3 pb-2"><span className="text-white font-black tracking-widest text-base">APUESTA</span></div>
          <div className="px-3 mb-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
              {[{l:'MAYOR',c:'text-green-300',v:'x2'},{l:'IGUAL',c:'text-yellow-300',v:'x7'},{l:'MENOR',c:'text-blue-300',v:'x2'}].map(({l,c,v})=>(
                <div key={l} className="bg-green-800/60 rounded-xl p-2 border border-white/10">
                  <p className={`font-black ${c}`}>{l}</p>
                  <p className="text-white/60 text-[10px]">{v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => guess('higher')} disabled={guessing || !player || betAmount>(player?.tokens||0)}
                className="flex flex-col items-center gap-1 py-3 rounded-xl text-white font-black text-xs active:scale-95 transition-all disabled:opacity-40 border"
                style={{ background:'rgba(34,197,94,0.2)', borderColor:'rgba(34,197,94,0.4)' }}>
                <TrendingUp size={20} className="text-green-400" /><span className="text-green-300">MAYOR</span>
              </button>
              <button onClick={() => guess('equal')} disabled={guessing || !player || betAmount>(player?.tokens||0)}
                className="flex flex-col items-center gap-1 py-3 rounded-xl text-white font-black text-xs active:scale-95 transition-all disabled:opacity-40 border"
                style={{ background:'rgba(212,160,23,0.2)', borderColor:'rgba(212,160,23,0.4)' }}>
                <Minus size={20} className="text-yellow-400" /><span className="text-yellow-300">IGUAL</span>
              </button>
              <button onClick={() => guess('lower')} disabled={guessing || !player || betAmount>(player?.tokens||0)}
                className="flex flex-col items-center gap-1 py-3 rounded-xl text-white font-black text-xs active:scale-95 transition-all disabled:opacity-40 border"
                style={{ background:'rgba(96,165,250,0.2)', borderColor:'rgba(96,165,250,0.4)' }}>
                <TrendingDown size={20} className="text-blue-400" /><span className="text-blue-300">MENOR</span>
              </button>
            </div>
          </div>
          <div className="px-3 pb-2">
            <p className="text-center text-white text-[10px] font-black tracking-widest mb-2 opacity-80">TOKENS A APOSTAR</p>
            <div className="flex items-center justify-center gap-2">
              {[-10,-5].map(d=>(
                <button key={d} onClick={()=>changeBet(d)} disabled={guessing}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">{d}</button>
              ))}
              <div className="px-4 py-1.5 rounded-lg border-2 border-white/50 bg-green-900/60 min-w-[60px] text-center">
                <span className="text-white font-black text-sm">{betAmount}</span>
              </div>
              {[5,10].map(d=>(
                <button key={d} onClick={()=>changeBet(d)} disabled={guessing}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">+{d}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="h-4" />
    </div>
  )
}
