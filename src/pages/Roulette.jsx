import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB, boostDB } from '@/lib/db'
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import GameHeader from '@/components/GameHeader'

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
const WHEEL_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]

const INFO = [
  '🎡 Ruleta europea con 37 posiciones: números del 0 al 36.',
  '🔴 Rojo/Negro: ganas x2 si aciertas el color.',
  '🔢 Par/Impar o 1-18/19-36: ganas x2.',
  '📊 Docenas (1-12, 13-24, 25-36): ganas x3.',
  '🎯 Número exacto: ¡ganas x36!',
]

function checkWin(betType, result, exactNumber) {
  if (betType === 'exact') return result === exactNumber
  if (result === 0) return false
  const isRed = RED_NUMBERS.includes(result)
  if (betType === 'red') return isRed
  if (betType === 'black') return !isRed
  if (betType === 'even') return result % 2 === 0
  if (betType === 'odd') return result % 2 !== 0
  if (betType === 'low') return result >= 1 && result <= 18
  if (betType === 'high') return result >= 19 && result <= 36
  if (betType === 'dozen1') return result >= 1 && result <= 12
  if (betType === 'dozen2') return result >= 13 && result <= 24
  if (betType === 'dozen3') return result >= 25 && result <= 36
  return false
}

function getPayoutMultiplier(betType) {
  if (betType === 'exact') return 36
  if (['dozen1','dozen2','dozen3'].includes(betType)) return 3
  return 2
}

const BET_TYPES = [
  { id: 'red', label: 'ROJO', color: 'bg-red-600 border-red-500 text-white', payout: 'x2' },
  { id: 'black', label: 'NEGRO', color: 'bg-neutral-800 border-neutral-600 text-white', payout: 'x2' },
  { id: 'even', label: 'PAR', color: 'bg-secondary border-border text-foreground', payout: 'x2' },
  { id: 'odd', label: 'IMPAR', color: 'bg-secondary border-border text-foreground', payout: 'x2' },
  { id: 'low', label: '1–18', color: 'bg-secondary border-border text-foreground', payout: 'x2' },
  { id: 'high', label: '19–36', color: 'bg-secondary border-border text-foreground', payout: 'x2' },
  { id: 'dozen1', label: '1ª 12', color: 'bg-secondary border-border text-foreground', payout: 'x3' },
  { id: 'dozen2', label: '2ª 12', color: 'bg-secondary border-border text-foreground', payout: 'x3' },
  { id: 'dozen3', label: '3ª 12', color: 'bg-secondary border-border text-foreground', payout: 'x3' },
]

export default function Roulette() {
  const [player, setPlayer] = useState(null)
  const [selectedBet, setSelectedBet] = useState('red')
  const [exactNumber, setExactNumber] = useState(7)
  const [betAmount, setBetAmount] = useState(100)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [outcome, setOutcome] = useState(null)
  const [activeTab, setActiveTab] = useState('simple')

  useEffect(() => { loadPlayer() }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  const spin = async () => {
    if (!player || spinning || betAmount > player.tokens) return
    setSpinning(true)
    setOutcome(null)

    const resultIndex = Math.floor(Math.random() * WHEEL_NUMBERS.length)
    const resultNumber = WHEEL_NUMBERS[resultIndex]
    const degreesPerSlot = 360 / WHEEL_NUMBERS.length
    const spins = 5 + Math.floor(Math.random() * 3)
    const targetAngle = resultIndex * degreesPerSlot
    const newRotation = rotation + (spins * 360) + (360 - (rotation % 360)) + (360 - targetAngle) % 360
    setRotation(newRotation)

    setTimeout(async () => {
      const won = checkWin(selectedBet, resultNumber, exactNumber)
      const multiplier = getPayoutMultiplier(selectedBet)
      const rawPayout = won ? Math.floor(betAmount * multiplier) : 0

      // Procesar potenciadores activos
      const { finalPayout, finalPoints, shieldUsed } = await boostDB.processGameBoosts({
        userId: player.id,
        won,
        betAmount,
        basePayout: rawPayout,
        basePoints: won ? 50 : 5,
      })

      const newTokens = player.tokens - betAmount + finalPayout
      setOutcome({ won, payout: finalPayout, resultNumber, shieldUsed })

      const updated = await userDB.update(player.id, {
        tokens: newTokens,
        points: (player.points || 0) + finalPoints,
      })
      setPlayer(updated)

      await gameHistoryDB.create({
        userId: player.id,
        gameType: 'roulette',
        betAmount,
        result: { number: resultNumber, betType: selectedBet },
        winAmount: finalPayout,
        profit: finalPayout - betAmount,
        gameDetails: { betType: selectedBet, exactNumber, shieldUsed },
      })

      await statsDB.recordGame({
        userId: player.id,
        won: won || shieldUsed,
        payout: finalPayout,
        betAmount,
      })

      setSpinning(false)
    }, 4200)
  }

  const changeBet = (delta) => setBetAmount(prev => Math.max(10, Math.min(player?.tokens || 0, prev + delta)))
  const isActiveBet = (id) => selectedBet === id

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #1a0e05 0%, #0d0704 100%)' }}>
      <GameHeader title="RULETA" balance={player?.tokens} infoTitle="Cómo jugar Ruleta" infoContent={INFO} />

      {/* Wheel area */}
      <div className="flex justify-center items-center py-4 relative overflow-hidden">
        <div className="w-52 h-52 relative flex items-center justify-center">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[18px] border-t-yellow-400 drop-shadow-[0_2px_6px_rgba(212,160,23,0.8)]" />
          <motion.div
            animate={{ rotate: rotation }}
            transition={{ duration: 4.2, ease: [0.15, 0.9, 0.3, 1] }}
            className="w-48 h-48 rounded-full border-4 border-yellow-600 shadow-2xl relative flex items-center justify-center"
            style={{
              background: 'conic-gradient(#15803d 0deg 9.7deg, #dc2626 9.7deg 19.5deg, #1e1e1e 19.5deg 29.2deg, #dc2626 29.2deg 38.9deg, #1e1e1e 38.9deg 48.6deg, #dc2626 48.6deg 58.4deg, #1e1e1e 58.4deg 68.1deg, #dc2626 68.1deg 77.8deg, #1e1e1e 77.8deg 87.6deg, #dc2626 87.6deg 97.3deg, #1e1e1e 97.3deg 107deg, #dc2626 107deg 116.8deg, #1e1e1e 116.8deg 126.5deg, #dc2626 126.5deg 136.2deg, #1e1e1e 136.2deg 145.9deg, #dc2626 145.9deg 155.7deg, #1e1e1e 155.7deg 165.4deg, #dc2626 165.4deg 175.1deg, #1e1e1e 175.1deg 184.9deg, #dc2626 184.9deg 194.6deg, #1e1e1e 194.6deg 204.3deg, #dc2626 204.3deg 214.1deg, #1e1e1e 214.1deg 223.8deg, #dc2626 223.8deg 233.5deg, #1e1e1e 233.5deg 243.2deg, #dc2626 243.2deg 253deg, #1e1e1e 253deg 262.7deg, #dc2626 262.7deg 272.4deg, #1e1e1e 272.4deg 282.2deg, #dc2626 282.2deg 291.9deg, #1e1e1e 291.9deg 301.6deg, #dc2626 301.6deg 311.4deg, #1e1e1e 311.4deg 321.1deg, #dc2626 321.1deg 330.8deg, #1e1e1e 330.8deg 340.5deg, #dc2626 340.5deg 350.3deg, #1e1e1e 350.3deg 360deg)',
              boxShadow: '0 0 30px rgba(212,160,23,0.3), inset 0 0 20px rgba(0,0,0,0.8)',
            }}
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-700 via-yellow-900 to-yellow-950 border-2 border-yellow-500/50 flex items-center justify-center shadow-inner">
              <div className="w-14 h-14 rounded-full bg-black/60 border border-yellow-500/30 flex items-center justify-center">
                <span className="text-xl">🎡</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Outcome Banner */}
      <div className="px-4 mb-3 h-10 flex items-center justify-center">
        <AnimatePresence>
          {outcome && !spinning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`px-4 py-1.5 rounded-full text-sm font-black flex items-center gap-2 ${
                outcome.won ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                outcome.shieldUsed ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}
            >
              <span>{outcome.resultNumber === 0 ? '🟢 0' : RED_NUMBERS.includes(outcome.resultNumber) ? `🔴 ${outcome.resultNumber}` : `⚫ ${outcome.resultNumber}`}</span>
              <span>·</span>
              <span>{outcome.won ? `¡Ganaste +${outcome.payout.toLocaleString()} TOKENS!` : outcome.shieldUsed ? `🛡️ ¡Escudo activado! Apuesta salvada.` : `Perdiste -${betAmount.toLocaleString()} TOKENS`}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bet Options Tabs */}
      <div className="px-3 mb-3 flex-1 flex flex-col justify-end">
        <div className="flex rounded-xl overflow-hidden border border-border mb-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <button onClick={() => setActiveTab('simple')} className={`flex-1 py-1.5 text-xs font-black transition-all ${activeTab === 'simple' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            Apuestas Simples
          </button>
          <button onClick={() => setActiveTab('exact')} className={`flex-1 py-1.5 text-xs font-black transition-all ${activeTab === 'exact' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            Número Exacto (x36)
          </button>
        </div>

        {activeTab === 'simple' ? (
          <div className="grid grid-cols-3 gap-2">
            {BET_TYPES.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBet(b.id)}
                disabled={spinning}
                className={`py-2.5 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center gap-0.5 ${b.color} ${
                  isActiveBet(b.id) ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-105' : 'opacity-80'
                }`}
              >
                <span>{b.label}</span>
                <span className="text-[9px] opacity-70 font-normal">{b.payout}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-4 bg-secondary/40 border border-border rounded-xl p-3">
              <button onClick={() => setExactNumber(p => Math.max(0, p - 1))} className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center font-bold text-lg"><ChevronLeft size={18} /></button>
              <div className="text-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black mx-auto ${exactNumber === 0 ? 'bg-green-700 text-white' : RED_NUMBERS.includes(exactNumber) ? 'bg-red-600 text-white' : 'bg-neutral-800 text-white'}`}>
                  {exactNumber}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 block">Paga x36</span>
              </div>
              <button onClick={() => setExactNumber(p => Math.min(36, p + 1))} className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center font-bold text-lg"><ChevronRight size={18} /></button>
            </div>
            <button onClick={() => setSelectedBet('exact')} className={`w-full py-2 rounded-xl text-xs font-black border transition-all ${isActiveBet('exact') ? 'btn-gold' : 'bg-secondary/60 border-border text-foreground'}`}>
              {isActiveBet('exact') ? '✓ Apostando a número ' + exactNumber : 'Seleccionar este número'}
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-3 pb-6 space-y-3">
        <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-2">
          <button onClick={() => changeBet(-50)} disabled={spinning} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95 disabled:opacity-50">-50</button>
          <div className="text-center">
            <span className="text-[10px] text-muted-foreground block">APUESTA</span>
            <span className="text-base font-black text-primary">{betAmount.toLocaleString()} TKN</span>
          </div>
          <button onClick={() => changeBet(50)} disabled={spinning} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95 disabled:opacity-50">+50</button>
        </div>

        <button
          onClick={spin}
          disabled={spinning || (player?.tokens || 0) < betAmount}
          className="w-full py-4 rounded-2xl font-black text-base btn-gold disabled:opacity-50 shadow-lg tracking-wider active:scale-95 transition-all"
        >
          {spinning ? 'GIRANDO...' : 'GIRAR RULETA'}
        </button>
      </div>
    </div>
  )
}
