import { useState, useEffect, useRef } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB, boostDB } from '@/lib/db'
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
    // Procesar potenciadores activos
    const { finalPayout, finalPoints, shieldUsed } = await boostDB.processGameBoosts({
      userId: currentPlayer.id,
      won,
      betAmount,
      basePayout: won ? payout : 0,
      basePoints: won ? 40 : 5,
    })

    const newTokens = currentPlayer.tokens + finalPayout

    const updated = await userDB.update(currentPlayer.id, {
      tokens: newTokens,
      points: (currentPlayer.points || 0) + finalPoints,
    })
    setPlayer(updated)

    await gameHistoryDB.create({
      userId: currentPlayer.id,
      gameType: 'crash',
      betAmount,
      result: { multiplier: at, won, shieldUsed },
      winAmount: finalPayout,
      profit: finalPayout - betAmount,
      gameDetails: { cashedAt: at, shieldUsed },
    })

    await statsDB.recordGame({
      userId: currentPlayer.id,
      won: won || shieldUsed,
      payout: finalPayout,
      betAmount,
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
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">GANANCIA ACTUAL</p>
          <p className="text-2xl font-black text-primary">
            {phase==='running' ? `+${Math.floor(betAmount*multiplier).toLocaleString()}` : phase==='cashed' ? `+${Math.floor(betAmount*cashedAt).toLocaleString()}` : '0'} TKN
          </p>
        </div>
      </div>
      <div className="px-3 pb-6 space-y-3">
        {phase==='waiting' && (
          <>
            <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-2">
              <button onClick={()=>changeBet(-50)} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95">-50</button>
              <div className="text-center"><span className="text-[10px] text-muted-foreground block">APUESTA</span><span className="text-base font-black text-primary">{betAmount.toLocaleString()} TKN</span></div>
              <button onClick={()=>changeBet(50)} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95">+50</button>
            </div>
            <button onClick={startRound} disabled={(player?.tokens||0)<betAmount} className="w-full py-4 rounded-2xl font-black text-base btn-gold shadow-lg tracking-wider active:scale-95 transition-all">INICIAR RONDA</button>
          </>
        )}
        {phase==='running' && (
          <button onClick={cashOut} className="w-full py-5 rounded-2xl font-black text-xl text-white shadow-2xl tracking-wider active:scale-95 transition-all"
            style={{background:'linear-gradient(135deg,#22c55e,#15803d)',boxShadow:'0 0 30px rgba(34,197,94,0.5)'}}>
            COBRAR {(betAmount*multiplier).toFixed(0)} TKN
          </button>
        )}
        {(phase==='crashed'||phase==='cashed') && (
          <button onClick={reset} className="w-full py-4 rounded-2xl font-black text-base btn-gold shadow-lg tracking-wider active:scale-95 transition-all">OTRA PARTIDA</button>
        )}
      </div>
    </div>
  )
}
