import { useState, useEffect, useRef } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB } from '@/lib/db'
import { TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import GameHeader from '@/components/GameHeader'

const INFO = [
  '🚀 El multiplicador empieza en x1.00 y sube con el tiempo.',
  '💰 Presiona COBRAR antes de que explote para ganar.',
  '💥 Si explota antes de cobrar, pierdes tu apuesta.',
  '⚡ Elige tu apuesta, presiona INICIAR y cobra en el momento justo.',
]

export default function Crash() {
  const [player, setPlayer] = useState(null)
  const [betAmount, setBetAmount] = useState(100)
  const [phase, setPhase] = useState('waiting')
  const [multiplier, setMultiplier] = useState(1.00)
  const [cashedAt, setCashedAt] = useState(null)
  const [crashPoint, setCrashPoint] = useState(null)
  const intervalRef = useRef(null)
  const crashRef = useRef(null)

  useEffect(() => { loadPlayer() }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  const generateCrashPoint = () => {
    const r = Math.random()
    if (r < 0.20) return 1.01 + Math.random() * 0.19
    if (r < 0.42) return 1.20 + Math.random() * 0.30
    if (r < 0.62) return 1.50 + Math.random() * 0.50
    if (r < 0.78) return 2.00 + Math.random() * 1.50
    if (r < 0.90) return 3.50 + Math.random() * 3.50
    if (r < 0.97) return 7.00 + Math.random() * 13.0
    return 20 + Math.random() * 30
  }

  const startRound = async () => {
    if (!player || betAmount > player.tokens || phase === 'running') return
    const cp = generateCrashPoint()
    crashRef.current = cp
    setCrashPoint(null); setCashedAt(null); setMultiplier(1.00); setPhase('running')
    const updated = await userDB.update(player.id, { tokens: player.tokens - betAmount })
    setPlayer(updated)
    let current = 1.00
    intervalRef.current = setInterval(() => {
      current = parseFloat((current + current * 0.03).toFixed(2))
      setMultiplier(current)
      if (current >= crashRef.current) {
        clearInterval(intervalRef.current)
        setCrashPoint(parseFloat(crashRef.current.toFixed(2)))
        setPhase('crashed')
        saveResult(false, 0, parseFloat(crashRef.current.toFixed(2)), updated)
      }
    }, 150)
  }

  const cashOut = () => {
    if (phase !== 'running') return
    clearInterval(intervalRef.current)
    const at = multiplier
    setCashedAt(at); setPhase('cashed')
    const payout = Math.floor(betAmount * at)
    saveResult(true, payout, at, player)
  }

  const saveResult = async (won, payout, at, currentPlayer) => {
    const newTokens = currentPlayer.tokens + (won ? payout : 0)
    const newStreak = won ? (currentPlayer.user_statistics?.current_streak || 0) + 1 : 0
    const newBestStreak = Math.max(currentPlayer.user_statistics?.best_streak || 0, newStreak)

    const updated = await userDB.update(currentPlayer.id, {
      tokens: newTokens,
      points: (currentPlayer.points || 0) + (won ? 40 : 5),
    })
    setPlayer(updated)

    await gameHistoryDB.create({
      userId: currentPlayer.id,
      gameType: 'crash',
      betAmount,
      result: { multiplier: at, won },
      winAmount: won ? payout : 0,
      profit: won ? payout - betAmount : -betAmount,
      gameDetails: { cashedAt: at },
    })

    await statsDB.update(currentPlayer.id, {
      total_games_played: (currentPlayer.user_statistics?.total_games_played || 0) + 1,
      total_winnings: (currentPlayer.user_statistics?.total_winnings || 0) + (won ? payout : 0),
      total_losses: (currentPlayer.user_statistics?.total_losses || 0) + (won ? 0 : betAmount),
      biggest_win: Math.max(currentPlayer.user_statistics?.biggest_win || 0, won ? payout : 0),
      current_streak: newStreak,
      best_streak: newBestStreak,
    })
  }

  const reset = () => { setPhase('waiting'); setMultiplier(1.00) }
  const changeBet = (d) => setBetAmount(p => Math.max(10, Math.min(player?.tokens||0, p+d)))
  const multColor = multiplier >= 3 ? '#22c55e' : multiplier >= 2 ? '#f6d365' : '#ffffff'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg,#1a0e05,#0d0704)' }}>
      <GameHeader title="CRASH" balance={player?.tokens} infoTitle="Cómo jugar Crash" infoContent={INFO} />
      <div className="flex justify-center items-center py-6">
        <motion.div animate={phase==='crashed'?{scale:[1,1.1,0.95,1]}:{}}
          className="w-48 h-48 rounded-full flex flex-col items-center justify-center"
          style={{
            background: phase==='crashed'?'radial-gradient(circle,#3a0000,#1a0000)':phase==='cashed'?'radial-gradient(circle,#003a10,#001a08)':'radial-gradient(circle,#1a1200,#0d0900)',
            border: `3px solid ${phase==='crashed'?'#dc2626':phase==='cashed'?'#22c55e':'#d4a017'}`,
            boxShadow: `0 0 40px ${phase==='crashed'?'rgba(220,38,38,0.4)':phase==='cashed'?'rgba(34,197,94,0.4)':'rgba(212,160,23,0.3)'}`,
          }}>
          {phase==='crashed' ? (<><div className="text-4xl mb-1">💥</div><div className="text-red-400 font-black text-lg">CRASH</div><div className="text-red-300 text-sm font-bold">{crashPoint?.toFixed(2)}x</div></>)
          : phase==='cashed' ? (<><div className="text-4xl mb-1">💰</div><div className="text-green-400 font-black text-xl">{cashedAt?.toFixed(2)}x</div><div className="text-green-300 text-sm">+{Math.floor(betAmount*cashedAt)} TOKENS</div></>)
          : (<><TrendingUp size={28} style={{color:multColor}} className="mb-1"/><div className="font-black text-4xl" style={{color:multColor}}>{multiplier.toFixed(2)}x</div>{phase==='waiting'&&<div className="text-muted-foreground text-xs mt-1">Listo</div>}</>)}
        </motion.div>
      </div>
      <div className="px-3 flex-1">
        <div className="rounded-2xl overflow-hidden" style={{background:'linear-gradient(180deg,#1a6b2e,#145923)',border:'3px solid #8B6914',boxShadow:'0 0 0 2px #d4a017'}}>
          <div className="text-center pt-3 pb-2"><span className="text-white font-black tracking-widest text-base">APUESTA</span></div>
          <div className="px-3 pb-2">
            <p className="text-center text-white text-[10px] font-black tracking-widest mb-2 opacity-80">TOKENS A APOSTAR</p>
            <div className="flex items-center justify-center gap-2">
              {[-10,-5].map(d=>(<button key={d} onClick={()=>changeBet(d)} disabled={phase==='running'}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">{d}</button>))}
              <div className="px-4 py-1.5 rounded-lg border-2 border-white/50 bg-green-900/60 min-w-[60px] text-center">
                <span className="text-white font-black text-sm">{betAmount}</span>
              </div>
              {[5,10].map(d=>(<button key={d} onClick={()=>changeBet(d)} disabled={phase==='running'}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">+{d}</button>))}
            </div>
          </div>
          <div className="px-4 pb-4 pt-1">
            {phase==='running' ? (
              <button onClick={cashOut} className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95"
                style={{background:'linear-gradient(180deg,#166534,#14532d)',border:'2px solid rgba(34,197,94,0.4)'}}>
                💰 COBRAR {multiplier.toFixed(2)}x
              </button>
            ) : (phase==='crashed'||phase==='cashed') ? (
              <button onClick={reset} className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95"
                style={{background:'linear-gradient(180deg,#2a2a2a,#111)',border:'2px solid rgba(255,255,255,0.15)'}}>
                NUEVA RONDA
              </button>
            ) : (
              <button onClick={startRound} disabled={!player||betAmount>(player?.tokens||0)} className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95 disabled:opacity-40"
                style={{background:'linear-gradient(180deg,#2a2a2a,#111)',border:'2px solid rgba(255,255,255,0.15)'}}>
                INICIAR
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="h-4"/>
    </div>
  )
}