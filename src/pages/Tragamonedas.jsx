import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB, boostDB } from '@/lib/db'
import { motion, AnimatePresence } from 'framer-motion'
import GameHeader from '@/components/GameHeader'

const SYMBOLS = ['🍒','🍋','🍊','⭐','💎','7️⃣','🔔','🍇']
const FRUIT_SYMBOLS = ['🍒','🍋','🍊','🍇']
const PAYOUTS = {
  '7️⃣7️⃣7️⃣':40,'💎💎💎':15,'⭐⭐⭐':8,'🔔🔔🔔':6,
  '🍒🍒🍒':4,'🍇🍇🍇':4,'🍊🍊🍊':3,'🍋🍋🍋':2,
}
const INFO = [
  '🎰 Gira 3 carretes. Si los 3 muestran el mismo símbolo, ¡ganas!',
  '7️⃣ Triple 7: ganas x40.',
  '💎 Triple Diamante: x15.',
  '⭐ Triple Estrella: x8.',
  '🔔 Triple Campana: x6.',
  '✅ Elige tu apuesta y presiona GIRAR.',
]
const REEL_POOL = [
  ...Array(9).fill('🍋'), ...Array(9).fill('🍊'), ...Array(8).fill('🍒'), ...Array(8).fill('🍇'),
  ...Array(5).fill('🔔'), ...Array(4).fill('⭐'), ...Array(2).fill('💎'), ...Array(1).fill('7️⃣'),
]
function randomSymbol() { return REEL_POOL[Math.floor(Math.random()*REEL_POOL.length)] }

function ReelStrip({ symbol, spinning, delay }) {
  return (
    <div className="w-16 h-20 rounded-xl overflow-hidden flex items-center justify-center relative"
      style={{background:'linear-gradient(180deg,#f5f5dc,#e8e0c8)',border:'3px solid #8B6914',boxShadow:'inset 0 2px 6px rgba(0,0,0,0.3)'}}>
      <motion.div animate={spinning?{y:[0,-40,40,0]}:{}} transition={{duration:0.3,repeat:spinning?Infinity:0,delay}}
        className="text-3xl select-none">
        {symbol}
      </motion.div>
    </div>
  )
}

export default function Tragamonedas() {
  const [player, setPlayer] = useState(null)
  const [reels, setReels] = useState(['🍒','💎','7️⃣'])
  const [betAmount, setBetAmount] = useState(100)
  const [spinning, setSpinning] = useState(false)
  const [outcome, setOutcome] = useState(null)

  useEffect(() => { loadPlayer() }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  const spin = async () => {
    if (!player || spinning || betAmount > player.tokens) return
    setSpinning(true); setOutcome(null)
    const r1=randomSymbol(),r2=randomSymbol(),r3=randomSymbol()
    setTimeout(async () => {
      setReels([r1,r2,r3])
      const combo=`${r1}${r2}${r3}`
      let mult=PAYOUTS[combo]||0
      if (!mult && r1===r2 && r2===r3 && FRUIT_SYMBOLS.includes(r1)) mult=2
      const won=mult>0
      const rawPayout=won?betAmount*mult:0

      // Procesar potenciadores activos
      const { finalPayout, finalPoints, shieldUsed } = await boostDB.processGameBoosts({
        userId: player.id,
        won,
        betAmount,
        basePayout: rawPayout,
        basePoints: won ? 35 : 4,
      })

      const newTokens=player.tokens-betAmount+finalPayout
      setOutcome({won,payout: finalPayout,mult,shieldUsed})

      const updated = await userDB.update(player.id, {
        tokens: newTokens,
        points: (player.points || 0) + finalPoints,
      })
      setPlayer(updated)

      await gameHistoryDB.create({
        userId: player.id,
        gameType: 'slots',
        betAmount,
        result: { reels: [r1,r2,r3], combo },
        winAmount: finalPayout,
        profit: finalPayout - betAmount,
        gameDetails: { multiplier: mult, shieldUsed },
      })

      await statsDB.recordGame({
        userId: player.id,
        won: won || shieldUsed,
        payout: finalPayout,
        betAmount,
      })

      setSpinning(false)
    }, 1800)
  }

  const changeBet = (d) => setBetAmount(p => Math.max(10, Math.min(player?.tokens||0, p+d)))

  return (
    <div className="min-h-screen flex flex-col" style={{background:'linear-gradient(180deg,#1a0e05,#0d0704)'}}>
      <GameHeader title="SLOTS" balance={player?.tokens} infoTitle="Cómo jugar Tragamonedas" infoContent={INFO} />
      <div className="flex justify-center mb-3 px-4">
        <div className="rounded-3xl p-5 w-full max-w-xs" style={{background:'linear-gradient(180deg,#4a2e0a,#2a1505)',border:'4px solid #8B6914',boxShadow:'0 0 0 2px #d4a017'}}>
          <div className="flex gap-3 justify-center mb-4">
            {reels.map((sym,i)=><ReelStrip key={i} symbol={sym} spinning={spinning} delay={i*0.05}/>)}
          </div>
          <div className="h-0.5 w-full rounded-full mb-3" style={{background:outcome?.won?'#22c55e':'#d4a017',opacity:0.6}}/>
          <div className="h-8 flex items-center justify-center">
            <AnimatePresence>
              {outcome&&!spinning&&(
                <motion.div initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
                  className={`px-4 py-1 rounded-full text-sm font-bold ${outcome.won?'text-green-400':outcome.shieldUsed?'text-blue-300':'text-red-400'}`}>
                  {outcome.won?`🎉 x${outcome.mult} · +${outcome.payout.toLocaleString()} TOKENS`:outcome.shieldUsed?`🛡️ ¡Escudo salvó tu apuesta!`: `😔 -${betAmount.toLocaleString()} TOKENS`}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="px-3 flex-1 overflow-y-auto mb-3">
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mb-2 text-center">Tabla de Pagos</p>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {Object.entries(PAYOUTS).slice(0,6).map(([combo,mult])=>(
            <div key={combo} className="flex justify-between items-center bg-card/60 border border-border/50 rounded-xl px-2.5 py-1.5">
              <span>{combo}</span>
              <span className="font-bold text-primary">x{mult}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-3 pb-6 space-y-3">
        <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-2">
          <button onClick={()=>changeBet(-50)} disabled={spinning} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95 disabled:opacity-50">-50</button>
          <div className="text-center"><span className="text-[10px] text-muted-foreground block">APUESTA</span><span className="text-base font-black text-primary">{betAmount.toLocaleString()} TKN</span></div>
          <button onClick={()=>changeBet(50)} disabled={spinning} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95 disabled:opacity-50">+50</button>
        </div>
        <button onClick={spin} disabled={spinning||(player?.tokens||0)<betAmount}
          className="w-full py-4 rounded-2xl font-black text-base btn-gold shadow-lg tracking-wider active:scale-95 transition-all">
          {spinning?'GIRANDO...':'GIRAR'}
        </button>
      </div>
    </div>
  )
}
