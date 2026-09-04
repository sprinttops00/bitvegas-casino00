import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB, boostDB, jackpotDB } from '@/lib/db'
import { getBoostNotifications } from '@/lib/boostNotify'
import { ArrowLeftRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import GameHeader from '@/components/GameHeader'
import BoostAlert from '@/components/BoostAlert'

const MAX_NUMBER = 10000 // números de 0000 a 9999
const HOUSE_EDGE = 0.95 // margen de la casa: se paga el 95% del multiplicador matemáticamente justo
const DIVISOR_POINTS = [1000, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 7500, 8000, 9000]
const DEFAULT_INDEX = DIVISOR_POINTS.indexOf(5000)

const INFO = [
  '🎲 El sistema genera un número aleatorio de 0000 a 9999.',
  '⚖️ Tú eliges dónde colocar el DIVISOR moviendo la barra, y apuestas a que el número salga por debajo (LOW) o por encima (HIGH) de ese punto.',
  '📊 Mientras más difícil sea acertar (probabilidad baja), mayor será tu multiplicador. Mientras más fácil, menor será el premio — así de simple.',
  '📌 Ejemplos: Divisor 5,000 (50%) → x1.90 · Divisor 2,500 en LOW o 7,500 en HIGH (25%) → x3.80 · Divisor 1,000 en LOW o 9,000 en HIGH (10%) → x9.50.',
  '👀 La probabilidad, el multiplicador y el premio posible se actualizan en tiempo real en la pantalla, antes de tirar.',
]

function formatNumber(n) {
  return String(n).padStart(4, '0')
}

function getMultiplier(probability) {
  return (1 / probability) * HOUSE_EDGE
}

export default function HighLow() {
  const [player, setPlayer] = useState(null)
  const [divisorIndex, setDivisorIndex] = useState(DEFAULT_INDEX)
  const [side, setSide] = useState('low') // 'low' | 'high'
  const [betAmount, setBetAmount] = useState(100)
  const [rolling, setRolling] = useState(false)
  const [displayNumber, setDisplayNumber] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [boostQueue, setBoostQueue] = useState([])

  useEffect(() => { loadPlayer() }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  const divisor = DIVISOR_POINTS[divisorIndex]
  const lowCount = divisor
  const highCount = MAX_NUMBER - divisor
  const probability = side === 'low' ? lowCount / MAX_NUMBER : highCount / MAX_NUMBER
  const multiplier = getMultiplier(probability)
  const potentialPayout = Math.floor(betAmount * multiplier)
  const lowWidthPct = (divisor / MAX_NUMBER) * 100

  const play = async () => {
    if (!player || rolling || betAmount > player.tokens) return
    setRolling(true)
    setOutcome(null)
    const currentPlayer = player
    const currentDivisor = divisor
    const currentSide = side
    const currentMultiplier = multiplier

    

    // 1. Descontamos la apuesta del saldo de inmediato, antes de la animación.
    setBoostQueue([]) // limpia cualquier aviso de potenciador que siga visible de la ronda anterior
    const afterBet = currentPlayer.tokens - betAmount
    const deducted = await userDB.update(currentPlayer.id, { tokens: afterBet })
    setPlayer(deducted)

    // Animación tipo "odómetro": números aleatorios parpadeando antes del resultado final
    const ticks = 10
    for (let i = 0; i < ticks; i++) {
      setDisplayNumber(Math.floor(Math.random() * MAX_NUMBER))
      await new Promise(r => setTimeout(r, 60 + i * 15))
    }

    const finalNumber = Math.floor(Math.random() * MAX_NUMBER)
    setDisplayNumber(finalNumber)

    const won = currentSide === 'low' ? finalNumber < currentDivisor : finalNumber >= currentDivisor
    const basePayout = won ? Math.floor(betAmount * currentMultiplier) : 0
    const basePoints = won ? Math.round(15 * currentMultiplier) : 4

    // 2. Aplicamos los potenciadores activos del inventario.
    const boostResult = await boostDB.processGameBoosts({
      userId: currentPlayer.id,
      won,
      betAmount,
      basePayout,
      basePoints,
    })

    // 3. Acreditamos el resultado final (ganancia, o reembolso si el escudo se activó).
    const finalTokens = afterBet + boostResult.finalPayout

    setOutcome({ won, payout: basePayout, number: finalNumber, divisor: currentDivisor, side: currentSide, multiplier: currentMultiplier })

    const updated = await userDB.update(currentPlayer.id, {
      tokens: finalTokens,
      points: (currentPlayer.points || 0) + boostResult.finalPoints,
      weekly_points: (currentPlayer.weekly_points || 0) + boostResult.finalPoints,
    })
    setPlayer(updated)

    // 4. Mostramos el aviso de potenciador si aplicó alguno.
    const notifications = getBoostNotifications({ boostResult, betAmount, basePoints })
    if (notifications.length > 0) setBoostQueue(prev => [...prev, ...notifications])

    // Si perdió de verdad (sin escudo), esos tokens alimentan el Jackpot semanal.
    if (!won && !boostResult.shieldUsed) {
      await jackpotDB.addToPot(betAmount)
    }

    await gameHistoryDB.create({
      userId: currentPlayer.id,
      gameType: 'highlow',
      betAmount,
      result: { number: finalNumber, divisor: currentDivisor, side: currentSide },
      winAmount: won ? boostResult.finalPayout : (boostResult.shieldUsed ? betAmount : 0),
      profit: boostResult.finalPayout - betAmount,
      gameDetails: { divisor: currentDivisor, side: currentSide, multiplier: currentMultiplier, boostApplied: boostResult.shieldUsed || boostResult.boostBonusTokens > 0 },
    })

    await statsDB.recordGame({
      userId: currentPlayer.id,
      won,
      payout: basePayout,
      betAmount: boostResult.shieldUsed ? 0 : betAmount,
    })

    setRolling(false)
  }

  const changeBet = (d) => setBetAmount(p => Math.max(10, Math.min(player?.tokens || 0, p + d)))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #1a0e05 0%, #0d0704 100%)' }}>
      <GameHeader player={player} title="HIGH / LOW" infoTitle="Cómo jugar High/Low" infoContent={INFO} />
      <BoostAlert
        notifications={boostQueue}
        onDismiss={(id) => setBoostQueue(prev => prev.filter(n => n.id !== id))}
      />

      {/* Número generado */}
      <div className="flex justify-center items-center py-4">
        <div className="w-40 h-20 rounded-2xl flex items-center justify-center" style={{
          background: outcome ? (outcome.won ? 'radial-gradient(circle,#22c55e,#15803d)' : 'radial-gradient(circle,#dc2626,#991b1b)') : 'radial-gradient(circle at 35% 30%, #fde68a, #d4a017 50%, #9a6f00)',
          boxShadow: '0 0 30px rgba(212,160,23,0.4)',
        }}>
          <span className="text-4xl font-black text-white tabular-nums tracking-widest">
            {displayNumber !== null ? formatNumber(displayNumber) : '----'}
          </span>
        </div>
      </div>

      {/* Resultado */}
      <div className="px-4 mb-2 h-8 flex items-center justify-center">
        <AnimatePresence>
          {outcome && !rolling && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`px-6 py-1 rounded-full text-sm font-bold ${outcome.won ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {outcome.won ? `🎉 x${outcome.multiplier.toFixed(2)} · +${outcome.payout.toLocaleString()} TOKENS` : `😔 -${betAmount.toLocaleString()} TOKENS`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-3 flex-1">
        <div className="rounded-2xl overflow-hidden" style={{
          background: 'linear-gradient(180deg, #1a6b2e 0%, #145923 100%)',
          border: '3px solid #8B6914', boxShadow: '0 0 0 2px #d4a017',
        }}>
          <div className="text-center pt-3 pb-2">
            <span className="text-white font-black tracking-widest text-base">APUESTA</span>
          </div>

          {/* Barra del divisor */}
          <div className={`px-4 mb-3 ${rolling ? 'pointer-events-none opacity-50' : ''}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black text-blue-300">0000</span>
              <div className="flex items-center gap-1 text-white/70 text-[10px] font-black">
                <ArrowLeftRight size={10} />
                DIVISOR: {formatNumber(divisor)}
              </div>
              <span className="text-[10px] font-black text-yellow-300">9999</span>
            </div>

            {/* Barra de zonas LOW/HIGH */}
            <div className="relative h-8 rounded-full overflow-hidden mb-2" style={{ border: '2px solid rgba(255,255,255,0.2)' }}>
              <div className="absolute inset-y-0 left-0" style={{ width: `${lowWidthPct}%`, background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)' }} />
              <div className="absolute inset-y-0 right-0" style={{ width: `${100 - lowWidthPct}%`, background: 'linear-gradient(90deg, #d4a017, #f6d365)' }} />
              <div className="absolute inset-y-0 flex items-center" style={{ left: `calc(${lowWidthPct}% - 2px)` }}>
                <div className="w-1 h-full bg-white" />
              </div>
            </div>

            {/* Selector de divisor (11 puntos fijos) */}
            <input
              type="range"
              min={0}
              max={DIVISOR_POINTS.length - 1}
              step={1}
              value={divisorIndex}
              onChange={(e) => setDivisorIndex(Number(e.target.value))}
              className="w-full mb-2 accent-yellow-500"
            />
            <div className="flex justify-between px-0.5 mb-3">
              {DIVISOR_POINTS.map((d, i) => (
                <button key={d} onClick={() => setDivisorIndex(i)}
                  className={`text-[8px] font-bold ${i === divisorIndex ? 'text-primary' : 'text-white/30'}`}>
                  {d / 1000}k
                </button>
              ))}
            </div>

            {/* Botones LOW / HIGH */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={() => setSide('low')}
                className={`py-3 rounded-xl font-black text-sm transition-all active:scale-95 border ${side === 'low' ? 'ring-2 ring-blue-400' : 'opacity-70'}`}
                style={{ background: 'rgba(59,130,246,0.2)', borderColor: 'rgba(59,130,246,0.4)' }}>
                <div className="text-blue-300">LOW</div>
                <div className="text-[9px] text-white/50">0000–{formatNumber(divisor - 1)}</div>
              </button>
              <button onClick={() => setSide('high')}
                className={`py-3 rounded-xl font-black text-sm transition-all active:scale-95 border ${side === 'high' ? 'ring-2 ring-yellow-400' : 'opacity-70'}`}
                style={{ background: 'rgba(212,160,23,0.2)', borderColor: 'rgba(212,160,23,0.4)' }}>
                <div className="text-yellow-300">HIGH</div>
                <div className="text-[9px] text-white/50">{formatNumber(divisor)}–9999</div>
              </button>
            </div>

            {/* Info en vivo: probabilidad / multiplicador / premio */}
            <div className="grid grid-cols-3 gap-1.5 mb-1">
              <div className="rounded-lg py-1.5 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
                <p className="text-[8px] text-white/50 font-bold">PROBABILIDAD</p>
                <p className="text-xs font-black text-white">{Math.round(probability * 100)}%</p>
              </div>
              <div className="rounded-lg py-1.5 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
                <p className="text-[8px] text-white/50 font-bold">MULTIPLICADOR</p>
                <p className="text-xs font-black text-primary">x{multiplier.toFixed(2)}</p>
              </div>
              <div className="rounded-lg py-1.5 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
                <p className="text-[8px] text-white/50 font-bold">PREMIO POSIBLE</p>
                <p className="text-xs font-black text-green-400">{potentialPayout.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="px-3 pb-2">
            <p className="text-center text-white text-[10px] font-black tracking-widest mb-2 opacity-80">TOKENS A APOSTAR</p>
            <div className="flex items-center justify-center gap-2">
              {[-10, -5].map(d => (
                <button key={d} onClick={() => changeBet(d)} disabled={rolling}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">{d}</button>
              ))}
              <div className="px-4 py-1.5 rounded-lg border-2 border-white/50 bg-green-900/60 min-w-[60px] text-center">
                <span className="text-white font-black text-sm">{betAmount}</span>
              </div>
              {[5, 10].map(d => (
                <button key={d} onClick={() => changeBet(d)} disabled={rolling}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">+{d}</button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-4 pt-1">
            <button onClick={play} disabled={rolling || !player || betAmount > (player?.tokens || 0)}
              className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95 disabled:opacity-40"
              style={{ background: rolling ? '#333' : 'linear-gradient(180deg,#2a2a2a,#111)', border: '2px solid rgba(255,255,255,0.15)' }}>
              {rolling ? '🎲 GIRANDO...' : 'TIRAR'}
            </button>
          </div>
        </div>
      </div>
      <div className="h-4" />
    </div>
  )
}
