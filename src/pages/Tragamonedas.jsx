import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB } from '@/lib/db'
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
      {spinning ? (
        <motion.div animate={{y:[-40,40]}} transition={{duration:0.15,repeat:Infinity,ease:'linear',delay}} className="text-3xl select-none">
          {randomSymbol()}
        </motion.div>
      ) : (
        <motion.div key={symbol} initial={{y:-30,opacity:0}} animate={{y:0,opacity:1}}
          transition={{type:'spring',stiffness:300,damping:20,delay}} className="text-3xl select-none">
          {symbol}
        </motion.div>
      )}
    </div>
  )
}

export default function Tragamonedas() {
  const [player, setPlayer] = useState(null)
  const [betAmount, setBetAmount] = useState(100)
  const [spinning, setSpinning] = useState(false)
  const [reels, setReels] = useState(['🍒','🍒','🍒'])
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
      const payout=won?betAmount*mult:0
      const newTokens=player.tokens-betAmount+payout
      setOutcome({won,payout,mult})
      const newStreak = won ? (player.user_statistics?.current_streak || 0) + 1 : 0
      const newBestStreak = Math.max(player.user_statistics?.best_streak || 0, newStreak)

      const updated = await userDB.update(player.id, {
        tokens: newTokens,
        points: (player.points || 0) + (won ? 35 : 4),
      })
      setPlayer(updated)

      await gameHistoryDB.create({
        userId: player.id,
        gameType: 'slots',
        betAmount,
        result: { reels: [r1,r2,r3], combo },
        winAmount: payout,
        profit: payout - betAmount,
        gameDetails: { multiplier: mult },
      })

      await statsDB.update(player.id, {
        total_games_played: (player.user_statistics?.total_games_played || 0) + 1,
        total_wins: (player.user_statistics?.total_wins || 0) + (won ? 1 : 0),
        total_losses: (player.user_statistics?.total_losses || 0) + (won ? 0 : betAmount),
        biggest_win: Math.max(player.user_statistics?.biggest_win || 0, won ? payout : 0),
        current_streak: newStreak,
        best_streak: newBestStreak,
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
                  className={`px-4 py-1 rounded-full text-sm font-bold ${outcome.won?'text-green-400':'text-red-400'}`}>
                  {outcome.won?`🎉 x${outcome.mult} · +${outcome.payout.toLocaleString()} TOKENS`:`😔 -${betAmount.toLocaleString()} TOKENS`}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="px-4 mb-2">
        <div className="rounded-xl px-3 py-2" style={{background:'rgba(212,160,23,0.08)',border:'1px solid rgba(212,160,23,0.2)'}}>
          <p className="text-[9px] text-primary font-black tracking-widest text-center mb-1.5">PREMIOS</p>
          <div className="grid grid-cols-4 gap-1 text-center">
            {Object.entries(PAYOUTS).slice(0,4).map(([k,v])=>(
              <div key={k} className="text-[10px]">
                <div>{k.slice(0,2)}x3</div>
                <div className="text-primary font-bold">x{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-3 flex-1">
        <div className="rounded-2xl overflow-hidden" style={{background:'linear-gradient(180deg,#1a6b2e,#145923)',border:'3px solid #8B6914',boxShadow:'0 0 0 2px #d4a017'}}>
          <div className="px-3 py-2">
            <p className="text-center text-white text-[10px] font-black tracking-widest mb-2 opacity-80">TOKENS A APOSTAR</p>
            <div className="flex items-center justify-center gap-2">
              {[-10,-5].map(d=>(<button key={d} onClick={()=>changeBet(d)} disabled={spinning}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">{d}</button>))}
              <div className="px-4 py-1.5 rounded-lg border-2 border-white/50 bg-green-900/60 min-w-[60px] text-center">
                <span className="text-white font-black text-sm">{betAmount}</span>
              </div>
              {[5,10].map(d=>(<button key={d} onClick={()=>changeBet(d)} disabled={spinning}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">+{d}</button>))}
            </div>
          </div>
          <div className="px-4 pb-4 pt-1">
            <button onClick={spin} disabled={spinning||!player||betAmount>(player?.tokens||0)}
              className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95 disabled:opacity-40"
              style={{background:spinning?'#333':'linear-gradient(180deg,#2a2a2a,#111)',border:'2px solid rgba(255,255,255,0.15)'}}>
              {spinning?'🎰 GIRANDO...':'🎰 GIRAR'}
            </button>
          </div>
        </div>
      </div>
      <div className="h-4"/>
    </div>
  )
}
