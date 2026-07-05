import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB } from '@/lib/db'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import GameHeader from '@/components/GameHeader'

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
    const totalPayout = basePayout + streakBonus
    const newTokens = player.tokens - betAmount + totalPayout

    setStreak(newStreak)
    setOutcome({ won, payout: totalPayout, next: displayNext, choice, streakBonus })

    const newBestStreak = Math.max(player.user_statistics?.best_streak || 0, newStreak)

    const updated = await userDB.update(player.id, {
      tokens: newTokens,
      points: (player.points || 0) + (won ? 25 : 3),
    })
    setPlayer(updated)

    await gameHistoryDB.create({
      userId: player.id,
      gameType: 'highlow',
      betAmount,
      result: { next: displayNext, choice },
      winAmount: totalPayout,
      profit: totalPayout - betAmount,
      gameDetails: { choice, streakBonus },
    })

    await statsDB.update(player.id, {
      total_games_played: (player.user_statistics?.total_games_played || 0) + 1,
      total_winnings: (player.user_statistics?.total_winnings || 0) + (won ? totalPayout : 0),
      total_losses: (player.user_statistics?.total_losses || 0) + (won ? 0 : betAmount),
      biggest_win: Math.max(player.user_statistics?.biggest_win || 0, won ? totalPayout : 0),
      current_streak: newStreak,
      best_streak: newBestStreak,
    })

    setTimeout(() => { setCurrentNumber(displayNext); setNextNumber(null); setGuessing(false) }, 1500)
  }

  const changeBet = (d) => setBetAmount(p => Math.max(10, Math.min(player?.tokens||0, p+d)))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #1a0e05 0%, #0d0704 100%)' }}>
      <GameHeader title="HIGH / LOW" balance={player?.tokens} infoTitle="Cómo jugar High/Low" infoContent={INFO} />
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