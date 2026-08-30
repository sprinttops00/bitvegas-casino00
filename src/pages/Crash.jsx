import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB, boostDB, jackpotDB } from '@/lib/db'
import { getBoostNotifications } from '@/lib/boostNotify'
import { Bomb, Gem } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import GameHeader from '@/components/GameHeader'
import BoostAlert from '@/components/BoostAlert'

const GRID_SIZE = 25 // tablero 5x5
const BOMB_COUNT = 5
const SAFE_COUNT = GRID_SIZE - BOMB_COUNT // 20 casillas seguras

// Curva de multiplicadores por cada casilla segura encontrada (1ra a 19na).
// Diseñada para arrancar calcada a la progresión clásica (x1.10, x1.25, x1.45...)
// y suavizarse después, para que el PERFECT RUN (casilla 20) siga siendo
// el premio más grande del juego, sin números que se disparen sin control.
const MULTIPLIER_TABLE = [
  1.10, 1.25, 1.45, 1.70, 2.00, 2.35, 2.75, 3.20, 3.70, 4.25,
  4.85, 5.50, 6.20, 6.95, 7.75, 8.60, 9.20, 9.55, 9.80,
]
const PERFECT_RUN_MULTIPLIER = 10.0

const INFO = [
  '💣 Hay 5 bombas ocultas entre las 25 casillas del tablero. El resto son seguras.',
  '💎 Cada casilla segura que descubras aumenta tu multiplicador — mientras más arriesgues, más puede crecer.',
  '💰 Puedes presionar COBRAR en cualquier momento y quedarte con lo acumulado hasta ese punto.',
  '💥 Si descubres una bomba antes de cobrar, pierdes toda tu apuesta de esa ronda.',
  '🏆 ¡Descubre las 20 casillas seguras sin explotar y gana el PERFECT RUN: x10 tu apuesta!',
]

function generateBombs() {
  const positions = Array.from({ length: GRID_SIZE }, (_, i) => i)
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]]
  }
  return new Set(positions.slice(0, BOMB_COUNT))
}

export default function Crash() {
  const [player, setPlayer] = useState(null)
  const [betAmount, setBetAmount] = useState(100)
  const [phase, setPhase] = useState('idle') // idle | playing | exploded | cashed | perfect
  const [bombs, setBombs] = useState(new Set())
  const [revealed, setRevealed] = useState([]) // índices de casillas seguras ya descubiertas
  const [lastBombHit, setLastBombHit] = useState(null)
  const [resultAmount, setResultAmount] = useState(0)
  const [boostQueue, setBoostQueue] = useState([])

  useEffect(() => { loadPlayer() }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  const safeCount = revealed.length
  const currentMultiplier = safeCount === 0 ? 1.0 : (MULTIPLIER_TABLE[safeCount - 1] || PERFECT_RUN_MULTIPLIER)
  const potentialPayout = Math.floor(betAmount * currentMultiplier)

  const startRound = async () => {
    if (!player || phase === 'playing' || betAmount > player.tokens) return
    // 1. Descontamos la apuesta del saldo de inmediato, antes de iniciar el tablero.
    const afterBet = player.tokens - betAmount
    const updated = await userDB.update(player.id, { tokens: afterBet })
    setPlayer(updated)

    setBombs(generateBombs())
    setRevealed([])
    setLastBombHit(null)
    setResultAmount(0)
    setPhase('playing')
  }

  const revealCell = (idx) => {
    if (phase !== 'playing' || revealed.includes(idx)) return
    if (bombs.has(idx)) {
      setLastBombHit(idx)
      resolveRound(false, 0, revealed.length)
      return
    }
    const newRevealed = [...revealed, idx]
    setRevealed(newRevealed)
    if (newRevealed.length === SAFE_COUNT) {
      // ¡Tablero completo! Se acredita automáticamente el PERFECT RUN.
      resolveRound(true, Math.floor(betAmount * PERFECT_RUN_MULTIPLIER), SAFE_COUNT, true)
    }
  }

  const cashOut = () => {
    if (phase !== 'playing' || safeCount === 0) return
    resolveRound(true, potentialPayout, safeCount)
  }

  // won = si la ronda termina en victoria (cobró o completó el tablero)
  // basePayout = tokens antes de aplicar potenciadores
  const resolveRound = async (won, basePayout, tilesCleared, isPerfectRun = false) => {
    const currentPlayer = player
    const afterBet = currentPlayer.tokens - betAmount
    const basePoints = won ? (isPerfectRun ? 100 : 20 + tilesCleared * 3) : 5

    const boostResult = await boostDB.processGameBoosts({
      userId: currentPlayer.id,
      won,
      betAmount,
      basePayout,
      basePoints,
    })

    const finalTokens = afterBet + boostResult.finalPayout
    setResultAmount(boostResult.finalPayout)
    setPhase(won ? (isPerfectRun ? 'perfect' : 'cashed') : 'exploded')

    const updated = await userDB.update(currentPlayer.id, {
      tokens: finalTokens,
      points: (currentPlayer.points || 0) + boostResult.finalPoints,
      weekly_points: (currentPlayer.weekly_points || 0) + boostResult.finalPoints,
    })
    setPlayer(updated)

    // Si perdió de verdad (sin escudo), esos tokens alimentan el Jackpot semanal.
    if (!won && !boostResult.shieldUsed) {
      await jackpotDB.addToPot(betAmount)
    }

    const notifications = getBoostNotifications({ boostResult, betAmount, basePoints })
    if (notifications.length > 0) setBoostQueue(notifications)

    await gameHistoryDB.create({
      userId: currentPlayer.id,
      gameType: 'crash',
      betAmount,
      result: { tilesCleared, won, perfectRun: isPerfectRun },
      winAmount: won ? boostResult.finalPayout : (boostResult.shieldUsed ? betAmount : 0),
      profit: won ? boostResult.finalPayout - betAmount : (boostResult.shieldUsed ? 0 : -betAmount),
      gameDetails: { tilesCleared, perfectRun: isPerfectRun, boostApplied: boostResult.shieldUsed || boostResult.boostBonusTokens > 0 },
    })

    await statsDB.recordGame({
      userId: currentPlayer.id,
      won,
      payout: basePayout,
      betAmount: boostResult.shieldUsed ? 0 : betAmount,
    })
  }

  const reset = () => { setPhase('idle'); setRevealed([]); setBombs(new Set()); setLastBombHit(null) }
  const changeBet = (d) => setBetAmount(p => Math.max(10, Math.min(player?.tokens || 0, p + d)))

  const isRoundOver = phase === 'exploded' || phase === 'cashed' || phase === 'perfect'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #1a0e05 0%, #0d0704 100%)' }}>
      <GameHeader player={player} title="CRASH" infoTitle="Cómo jugar Crash" infoContent={INFO} />
      <BoostAlert
        notification={boostQueue[0] || null}
        onClose={() => setBoostQueue(prev => prev.slice(1))}
      />

      {/* Multiplicador actual / resultado */}
      <div className="px-4 mb-2 flex flex-col items-center justify-center" style={{ minHeight: 56 }}>
        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <p className="text-xs text-muted-foreground">Elige tu apuesta y presiona INICIAR</p>
          )}
          {phase === 'playing' && (
            <motion.div key="playing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <p className="text-3xl font-black" style={{ color: '#f6d365' }}>x{currentMultiplier.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{safeCount}/{SAFE_COUNT} casillas seguras · {potentialPayout.toLocaleString()} TOKENS</p>
            </motion.div>
          )}
          {phase === 'exploded' && (
            <motion.div key="exploded" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <p className="text-2xl font-black text-red-400">💥 ¡EXPLOTÓ!</p>
              <p className="text-[10px] text-muted-foreground">Apostaste {betAmount.toLocaleString()} TOKENS · Ganancia: {resultAmount.toLocaleString()} TOKENS</p>
            </motion.div>
          )}
          {phase === 'cashed' && (
            <motion.div key="cashed" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <p className="text-2xl font-black text-green-400">💰 ¡COBRASTE!</p>
              <p className="text-[10px] text-muted-foreground">x{currentMultiplier.toFixed(2)} · +{resultAmount.toLocaleString()} TOKENS</p>
            </motion.div>
          )}
          {phase === 'perfect' && (
            <motion.div key="perfect" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <p className="text-2xl font-black" style={{ color: '#f6d365' }}>💎 ¡PERFECT RUN!</p>
              <p className="text-[10px] text-muted-foreground">Tablero completo · x{PERFECT_RUN_MULTIPLIER.toFixed(0)} · +{resultAmount.toLocaleString()} TOKENS</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tablero 5x5 */}
      <div className="flex justify-center mb-3 px-4">
        <div className="grid grid-cols-5 gap-1.5 p-3 rounded-2xl" style={{
          background: 'linear-gradient(180deg, #1a6b2e 0%, #145923 100%)',
          border: '3px solid #8B6914', boxShadow: '0 0 0 2px #d4a017',
        }}>
          {Array.from({ length: GRID_SIZE }, (_, idx) => {
            const isRevealedSafe = revealed.includes(idx)
            const isBombCell = bombs.has(idx)
            const showAll = isRoundOver
            const isTheBombHit = idx === lastBombHit

            let content = null
            let bg = 'rgba(0,0,0,0.35)'
            let border = 'rgba(255,255,255,0.15)'

            if (showAll && isBombCell) {
              content = <Bomb size={16} className={isTheBombHit ? 'text-white' : 'text-red-300'} />
              bg = isTheBombHit ? 'radial-gradient(circle, #dc2626, #7f1d1d)' : 'rgba(127,29,29,0.5)'
              border = 'rgba(220,38,38,0.6)'
            } else if (showAll && !isBombCell) {
              content = <Gem size={16} className="text-primary" />
              bg = isRevealedSafe ? 'radial-gradient(circle, #fde68a, #d4a017)' : 'rgba(212,160,23,0.15)'
              border = 'rgba(212,160,23,0.4)'
            } else if (isRevealedSafe) {
              content = <Gem size={16} className="text-yellow-900" />
              bg = 'radial-gradient(circle, #fde68a, #d4a017)'
              border = '#f6d365'
            }

            return (
              <button
                key={idx}
                onClick={() => revealCell(idx)}
                disabled={phase !== 'playing' || isRevealedSafe}
                className="w-12 h-12 rounded-lg flex items-center justify-center transition-all active:scale-90 disabled:active:scale-100"
                style={{ background: bg, border: `1.5px solid ${border}` }}
              >
                {content}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel de apuesta y controles */}
      <div className="px-3 flex-1">
        <div className="rounded-2xl overflow-hidden" style={{
          background: 'linear-gradient(180deg, #1a6b2e 0%, #145923 100%)',
          border: '3px solid #8B6914', boxShadow: '0 0 0 2px #d4a017',
        }}>
          <div className="text-center pt-3 pb-2">
            <span className="text-white font-black tracking-widest text-base">APUESTA</span>
          </div>
          <div className="px-3 pb-2">
            <p className="text-center text-white text-[10px] font-black tracking-widest mb-2 opacity-80">TOKENS A APOSTAR</p>
            <div className="flex items-center justify-center gap-2">
              {[-10, -5].map(d => (
                <button key={d} onClick={() => changeBet(d)} disabled={phase === 'playing'}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">{d}</button>
              ))}
              <div className="px-4 py-1.5 rounded-lg border-2 border-white/50 bg-green-900/60 min-w-[60px] text-center">
                <span className="text-white font-black text-sm">{betAmount}</span>
              </div>
              {[5, 10].map(d => (
                <button key={d} onClick={() => changeBet(d)} disabled={phase === 'playing'}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">+{d}</button>
              ))}
            </div>
          </div>
          <div className="px-4 pb-4 pt-1">
            {phase === 'playing' ? (
              <button onClick={cashOut} disabled={safeCount === 0}
                className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95 disabled:opacity-40"
                style={{ background: 'linear-gradient(180deg,#166534,#14532d)', border: '2px solid rgba(34,197,94,0.4)' }}>
                💰 COBRAR {safeCount > 0 ? potentialPayout.toLocaleString() : ''}
              </button>
            ) : isRoundOver ? (
              <button onClick={reset}
                className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95"
                style={{ background: 'linear-gradient(180deg,#2a2a2a,#111)', border: '2px solid rgba(255,255,255,0.15)' }}>
                NUEVA RONDA
              </button>
            ) : (
              <button onClick={startRound} disabled={!player || betAmount > (player?.tokens || 0)}
                className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95 disabled:opacity-40"
                style={{ background: 'linear-gradient(180deg,#2a2a2a,#111)', border: '2px solid rgba(255,255,255,0.15)' }}>
                💣 INICIAR
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="h-4" />
    </div>
  )
}
