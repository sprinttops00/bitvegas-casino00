import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB, boostDB, jackpotDB } from '@/lib/db'
import { getBoostNotifications } from '@/lib/boostNotify'
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import GameHeader from '@/components/GameHeader'
import BoostAlert from '@/components/BoostAlert'

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
  if (['red','black','even','odd','low','high'].includes(betType)) return 2
  return 3
}

function RouletteWheel({ rotation, spinning }) {
  const slots = WHEEL_NUMBERS.length
  const deg = 360 / slots
  return (
    <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
      <div className="absolute inset-0 rounded-full" style={{
        background: 'radial-gradient(circle at 35% 35%, #8B5E3C, #4a2e0a 60%, #2a1505)',
        boxShadow: '0 0 0 6px #6b3a10, 0 0 0 10px #3d1f05, 0 8px 40px rgba(0,0,0,0.8)',
      }} />
      <div className="absolute rounded-full overflow-hidden" style={{
        width: 210, height: 210,
        transition: spinning ? 'transform 4s cubic-bezier(0.17,0.67,0.12,1.0)' : 'none',
        transform: `rotate(${rotation}deg)`,
      }}>
        {WHEEL_NUMBERS.map((num, i) => {
          const angle = i * deg
          const isRed = RED_NUMBERS.includes(num)
          const isGreen = num === 0
          const color = isGreen ? '#16a34a' : isRed ? '#dc2626' : '#111111'
          return (
            <div key={i} className="absolute w-full h-full" style={{ transform: `rotate(${angle}deg)` }}>
              <div style={{
                position: 'absolute', top: 0, left: '50%',
                transform: 'translateX(-50%)', width: 24, height: 105,
                background: color, clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 5,
              }}>
                <span style={{ color: 'white', fontSize: 8, fontWeight: 'bold', transform: 'rotate(180deg)', display: 'block', marginTop: 2 }}>
                  {num}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="absolute rounded-full" style={{ width: 100, height: 100, background: 'radial-gradient(circle at 35% 35%, #4a2e0a, #1a0a02)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)' }} />
      <div className="absolute rounded-full flex items-center justify-center z-10" style={{
        width: 52, height: 52,
        background: 'radial-gradient(circle at 35% 30%, #f6d365, #d4a017 50%, #9a6f00)',
        boxShadow: '0 2px 12px rgba(212,160,23,0.6)',
      }}>
        <div className="rounded-full" style={{ width: 18, height: 18, background: 'radial-gradient(circle at 35% 30%, #fff9c4, #d4a017)' }} />
      </div>
      <div className="absolute z-20" style={{ top: -4, left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '18px solid #f6d365', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
      </div>
    </div>
  )
}

export default function Roulette() {
  const [player, setPlayer] = useState(null)
  const [selectedBet, setSelectedBet] = useState('red')
  const [betAmount, setBetAmount] = useState(100)
  const [exactNumber, setExactNumber] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [boostQueue, setBoostQueue] = useState([])

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

    // 1. Descontamos la apuesta del saldo de inmediato, antes de que corra la animación.
    const currentPlayer = player
    const afterBet = currentPlayer.tokens - betAmount
    const deducted = await userDB.update(currentPlayer.id, { tokens: afterBet })
    setPlayer(deducted)

    setTimeout(async () => {
      const won = checkWin(selectedBet, resultNumber, exactNumber)
      const multiplier = getPayoutMultiplier(selectedBet)
      const basePayout = won ? Math.floor(betAmount * multiplier) : 0
      const basePoints = won ? 50 : 5

      // 2. Aplicamos los potenciadores activos del inventario (escudo, amuleto, VIP, doble pts).
      const boostResult = await boostDB.processGameBoosts({
        userId: currentPlayer.id,
        won,
        betAmount,
        basePayout,
        basePoints,
      })

      // 3. Acreditamos el resultado final (ganancia, o reembolso si el escudo se activó).
      const finalTokens = afterBet + boostResult.finalPayout

      setOutcome({ won, payout: basePayout, resultNumber })

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
        gameType: 'roulette',
        betAmount,
        result: { number: resultNumber, betType: selectedBet },
        winAmount: won ? boostResult.finalPayout : (boostResult.shieldUsed ? betAmount : 0),
        profit: boostResult.finalPayout - betAmount,
        gameDetails: { betType: selectedBet, exactNumber, boostApplied: boostResult.shieldUsed || boostResult.boostBonusTokens > 0 },
      })

      await statsDB.recordGame({
        userId: currentPlayer.id,
        won,
        payout: basePayout,
        betAmount: boostResult.shieldUsed ? 0 : betAmount,
      })

      setSpinning(false)
    }, 4200)
  }

  const changeBet = (delta) => setBetAmount(prev => Math.max(10, Math.min(player?.tokens || 0, prev + delta)))
  const isActiveBet = (id) => selectedBet === id

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #1a0e05 0%, #0d0704 100%)' }}>
      <GameHeader title="RULETA" player={player} infoTitle="Cómo jugar Ruleta" infoContent={INFO} />
      <BoostAlert
        notification={boostQueue[0] || null}
        onClose={() => setBoostQueue(prev => prev.slice(1))}
      />
      <div className="flex justify-center mb-2">
        <RouletteWheel rotation={rotation} spinning={spinning} />
      </div>
      <div className="px-4 mb-2 h-8 flex items-center justify-center">
        <AnimatePresence>
          {outcome && !spinning && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`px-6 py-1 rounded-full text-sm font-bold ${outcome.won ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {outcome.won ? `🎉 +${outcome.payout.toLocaleString()} TOKENS` : `😔 -${betAmount.toLocaleString()} TOKENS`} · Nº {outcome.resultNumber}
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
          <div className="px-3 mb-3">
            <div className={`flex gap-1 mb-1 ${spinning ? 'pointer-events-none opacity-50' : ''}`}>
              <button onClick={() => setSelectedBet('odd')}
                className={`w-8 rounded-l-lg flex-none bg-green-800/80 border border-white/20 cursor-pointer select-none transition-all active:scale-95 text-white font-bold text-xs flex items-center justify-center ${isActiveBet('odd') ? 'ring-2 ring-yellow-400' : ''}`}>
                <div className="text-[9px] leading-tight">I<br/>M<br/>P<br/>A<br/>R</div>
              </button>
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex gap-1">
                  {['dozen1','dozen2','dozen3'].map((id, idx) => (
                    <button key={id} onClick={() => setSelectedBet(id)}
                      className={`flex-1 py-2 bg-green-700/80 border border-white/20 text-white font-bold text-xs text-center transition-all active:scale-95 ${isActiveBet(id) ? 'ring-2 ring-yellow-400' : ''}`}>
                      {['1-12','13-24','25-36'][idx]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {['low','high'].map((id, idx) => (
                    <button key={id} onClick={() => setSelectedBet(id)}
                      className={`flex-1 py-2 bg-green-700/80 border border-white/20 text-white font-bold text-xs text-center transition-all active:scale-95 ${isActiveBet(id) ? 'ring-2 ring-yellow-400' : ''}`}>
                      {['1-18','19-36'][idx]}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setSelectedBet('even')}
                className={`w-8 rounded-r-lg flex-none bg-green-800/80 border border-white/20 cursor-pointer select-none transition-all active:scale-95 text-white font-bold text-xs flex items-center justify-center ${isActiveBet('even') ? 'ring-2 ring-yellow-400' : ''}`}>
                <div className="text-[9px] leading-tight">P<br/>A<br/>R</div>
              </button>
            </div>
            <div className={`flex items-center gap-1 mt-1 ${spinning ? 'pointer-events-none opacity-50' : ''}`}>
              <button onClick={() => setSelectedBet('red')}
                className={`w-10 h-12 rounded-lg flex items-center justify-center transition-all active:scale-95 ${isActiveBet('red') ? 'ring-2 ring-yellow-400' : ''}`}
                style={{ background: '#dc2626', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div style={{ width: 14, height: 20, background: '#dc2626', transform: 'rotate(45deg)', border: '2px solid rgba(255,100,100,0.5)' }} />
              </button>
              <div className="flex-1 bg-green-800/60 rounded-lg border border-white/20 px-2 py-1.5">
                <p className="text-white text-[9px] font-black text-center tracking-wider mb-1">NÚMERO EXACTO</p>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => { setExactNumber(p => Math.max(0, p-1)); setSelectedBet('exact') }}
                    className="w-6 h-6 rounded bg-green-700 border border-white/20 flex items-center justify-center active:scale-95">
                    <ChevronLeft size={12} className="text-white" />
                  </button>
                  <div className={`w-10 h-7 rounded border-2 flex items-center justify-center font-black text-sm cursor-pointer ${isActiveBet('exact') ? 'border-yellow-400 text-yellow-300' : 'border-white/40 text-white'}`}
                    onClick={() => setSelectedBet('exact')}>{exactNumber}</div>
                  <button onClick={() => { setExactNumber(p => Math.min(36, p+1)); setSelectedBet('exact') }}
                    className="w-6 h-6 rounded bg-green-700 border border-white/20 flex items-center justify-center active:scale-95">
                    <ChevronRight size={12} className="text-white" />
                  </button>
                </div>
              </div>
              <button onClick={() => setSelectedBet('black')}
                className={`w-10 h-12 rounded-lg flex items-center justify-center transition-all active:scale-95 ${isActiveBet('black') ? 'ring-2 ring-yellow-400' : ''}`}
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div style={{ width: 14, height: 20, background: '#222', transform: 'rotate(45deg)', border: '2px solid rgba(255,255,255,0.1)' }} />
              </button>
            </div>
          </div>
          <div className="px-3 pb-2">
            <p className="text-center text-white text-[10px] font-black tracking-widest mb-2 opacity-80">TOKENS A APOSTAR</p>
            <div className="flex items-center justify-center gap-2">
              {[-10,-5].map(d => (
                <button key={d} onClick={() => changeBet(d)} disabled={spinning}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">{d}</button>
              ))}
              <div className="px-4 py-1.5 rounded-lg border-2 border-white/50 bg-green-900/60 min-w-[60px] text-center">
                <span className="text-white font-black text-sm">{betAmount}</span>
              </div>
              {[5,10].map(d => (
                <button key={d} onClick={() => changeBet(d)} disabled={spinning}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">+{d}</button>
              ))}
            </div>
          </div>
          <div className="px-4 pb-4 pt-1">
            <button onClick={spin} disabled={spinning || !player || betAmount > (player?.tokens||0)}
              className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95 transition-all disabled:opacity-40"
              style={{ background: spinning?'#333':'linear-gradient(180deg,#2a2a2a,#111)', border:'2px solid rgba(255,255,255,0.15)', boxShadow:'0 4px 12px rgba(0,0,0,0.6)' }}>
              {spinning ? <span className="flex items-center justify-center gap-2"><RotateCcw size={18} className="animate-spin"/>GIRANDO...</span> : 'ACEPTAR'}
            </button>
          </div>
        </div>
      </div>
      <div className="h-4" />
    </div>
  )
}
