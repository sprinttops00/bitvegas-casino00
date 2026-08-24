import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB, boostDB } from '@/lib/db'
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
    setGuessing(true); setOutcome(null)

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
    const rawPayout = basePayout + streakBonus

    // Procesar potenciadores activos
    const { finalPayout, finalPoints, shieldUsed } = await boostDB.processGameBoosts({
      userId: player.id,
      won,
      betAmount,
      basePayout: rawPayout,
      basePoints: won ? 25 : 3,
    })

    const newTokens = player.tokens - betAmount + finalPayout

    setStreak(newStreak)
    setOutcome({ won, payout: finalPayout, next: displayNext, choice, streakBonus, shieldUsed })

    const updated = await userDB.update(player.id, {
      tokens: newTokens,
      points: (player.points || 0) + finalPoints,
    })
    setPlayer(updated)

    await gameHistoryDB.create({
      userId: player.id,
      gameType: 'highlow',
      betAmount,
      result: { next: displayNext, choice },
      winAmount: finalPayout,
      profit: finalPayout - betAmount,
      gameDetails: { choice, streakBonus, shieldUsed },
    })

    await statsDB.recordGame({
      userId: player.id,
      won: won || shieldUsed,
      payout: finalPayout,
      betAmount,
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
              className={`px-4 py-1 rounded-full text-xs font-black ${outcome.won ? 'bg-green-500/20 text-green-400 border border-green-500/30' : outcome.shieldUsed ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
              {outcome.won
                ? `¡CORRECTO! +${outcome.payout.toLocaleString()} TKN${outcome.streakBonus > 0 ? ' (Bono racha!)' : ''}`
                : outcome.shieldUsed ? `🛡️ ¡Escudo activado! Apuesta protegida.` : `INCORRECTO · -${betAmount.toLocaleString()} TKN`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {streak >= 2 && (
        <div className="text-center mb-2">
          <span className="text-xs font-black text-accent bg-accent/10 border border-accent/20 px-3 py-1 rounded-full animate-pulse">
            🔥 Racha: {streak} seguidas
          </span>
        </div>
      )}
      <div className="px-3 flex-1 flex flex-col justify-end mb-3">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => guess('higher')} disabled={guessing}
            className="py-4 rounded-2xl bg-secondary/80 border border-border hover:border-primary/50 text-foreground flex flex-col items-center gap-1 active:scale-95 transition-all">
            <TrendingUp size={22} className="text-green-400" />
            <span className="font-black text-xs">MAYOR</span>
            <span className="text-[10px] text-muted-foreground">x2</span>
          </button>
          <button onClick={() => guess('equal')} disabled={guessing}
            className="py-4 rounded-2xl bg-secondary/80 border border-border hover:border-primary/50 text-foreground flex flex-col items-center gap-1 active:scale-95 transition-all">
            <Minus size={22} className="text-primary" />
            <span className="font-black text-xs">IGUAL</span>
            <span className="text-[10px] text-primary font-bold">x7</span>
          </button>
          <button onClick={() => guess('lower')} disabled={guessing}
            className="py-4 rounded-2xl bg-secondary/80 border border-border hover:border-primary/50 text-foreground flex flex-col items-center gap-1 active:scale-95 transition-all">
            <TrendingDown size={22} className="text-red-400" />
            <span className="font-black text-xs">MENOR</span>
            <span className="text-[10px] text-muted-foreground">x2</span>
          </button>
        </div>
      </div>
      <div className="px-3 pb-6 space-y-3">
        <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-2">
          <button onClick={() => changeBet(-50)} disabled={guessing} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95 disabled:opacity-50">-50</button>
          <div className="text-center">
            <span className="text-[10px] text-muted-foreground block">APUESTA</span>
            <span className="text-base font-black text-primary">{betAmount.toLocaleString()} TKN</span>
          </div>
          <button onClick={() => changeBet(50)} disabled={guessing} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95 disabled:opacity-50">+50</button>
        </div>
      </div>
    </div>
  )
}
