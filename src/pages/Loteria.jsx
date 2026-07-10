import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB } from '@/lib/db'
import { motion, AnimatePresence } from 'framer-motion'
import GameHeader from '@/components/GameHeader'

const TOTAL_BALLS = 30
const PICK_COUNT = 5
const DRAW_COUNT = 7
const PRIZE_TABLE = [
  { matches:5, mult:60, label:'¡JACKPOT!' },
  { matches:4, mult:12, label:'4 aciertos' },
  { matches:3, mult:3, label:'3 aciertos' },
]
const INFO = [
  '🎱 Elige 5 números del 1 al 30. Se sortean 7 bolas al azar.',
  '🎯 5 aciertos: JACKPOT x60.',
  '4️⃣ 4 aciertos: x12.',
  '3️⃣ 3 aciertos: x3.',
]

function Ball({ number, isMatch, isDrawn, size='md' }) {
  const sz=size==='sm'?'w-7 h-7 text-xs':'w-10 h-10 text-sm'
  return (
    <motion.div initial={isDrawn?{scale:0,opacity:0}:{}} animate={{scale:1,opacity:1}}
      className={`${sz} rounded-full flex items-center justify-center font-black border-2`}
      style={{
        background:isMatch?'radial-gradient(circle at 35% 30%,#fde68a,#d4a017)':isDrawn?'radial-gradient(circle at 35% 30%,#4a90d9,#1a4a8a)':'rgba(255,255,255,0.08)',
        borderColor:isMatch?'#f6d365':isDrawn?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.15)',
        color:isMatch?'#78350f':isDrawn?'white':'rgba(255,255,255,0.5)',
        boxShadow:isMatch?'0 0 12px rgba(212,160,23,0.6)':'none',
      }}>
      {number}
    </motion.div>
  )
}

export default function Loteria() {
  const [player, setPlayer] = useState(null)
  const [betAmount, setBetAmount] = useState(100)
  const [picked, setPicked] = useState([])
  const [drawn, setDrawn] = useState([])
  const [drawing, setDrawing] = useState(false)
  const [outcome, setOutcome] = useState(null)

  useEffect(() => { loadPlayer() }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  const togglePick = (n) => {
    if (drawing || outcome) return
    if (picked.includes(n)) setPicked(prev=>prev.filter(x=>x!==n))
    else if (picked.length<PICK_COUNT) setPicked(prev=>[...prev,n])
  }

  const drawNumbers = async () => {
    if (!player||drawing||picked.length<PICK_COUNT||betAmount>player.tokens) return
    setDrawing(true); setDrawn([]); setOutcome(null)
    const pool=Array.from({length:TOTAL_BALLS},(_,i)=>i+1)
    const shuffled=pool.sort(()=>Math.random()-0.5).slice(0,DRAW_COUNT)
    for (let i=0;i<shuffled.length;i++) {
      await new Promise(r=>setTimeout(r,400))
      setDrawn(prev=>[...prev,shuffled[i]])
    }
    await new Promise(r=>setTimeout(r,300))
    const matches=picked.filter(n=>shuffled.includes(n)).length
    const prize=PRIZE_TABLE.find(p=>p.matches===matches)
    const won=!!prize
    const payout=won?betAmount*prize.mult:0
    const newTokens=player.tokens-betAmount+payout
    setOutcome({won,payout,matches,drawn:shuffled})
    setDrawing(false)
    const newStreak = won ? (player.user_statistics?.current_streak || 0) + 1 : 0
    const newBestStreak = Math.max(player.user_statistics?.best_streak || 0, newStreak)

    const updated = await userDB.update(player.id, {
      tokens: newTokens,
      points: (player.points || 0) + (won ? 45 : 5),
    })
    setPlayer(updated)

    await gameHistoryDB.create({
      userId: player.id,
      gameType: 'lottery',
      betAmount,
      result: { matches, drawn: shuffled, picked },
      winAmount: payout,
      profit: payout - betAmount,
      gameDetails: { prize: prize?.label },
    })

    await statsDB.update(player.id, {
      total_games_played: (player.user_statistics?.total_games_played || 0) + 1,
      total_wins: (player.user_statistics?.total_wins || 0) + (won ? 1 : 0),
      total_losses: (player.user_statistics?.total_losses || 0) + (won ? 0 : betAmount),
      biggest_win: Math.max(player.user_statistics?.biggest_win || 0, won ? payout : 0),
      current_streak: newStreak,
      best_streak: newBestStreak,
    })
  }

  const reset = () => { setPicked([]); setDrawn([]); setOutcome(null) }
  const changeBet = (d) => setBetAmount(p => Math.max(10, Math.min(player?.tokens||0, p+d)))

  return (
    <div className="min-h-screen flex flex-col" style={{background:'linear-gradient(180deg,#1a0e05,#0d0704)'}}>
      <GameHeader title="LOTERÍA" balance={player?.tokens} infoTitle="Cómo jugar Lotería" infoContent={INFO} />
      <p className="text-xs text-muted-foreground text-center mb-2">Elige {PICK_COUNT} números del 1 al {TOTAL_BALLS}</p>
      <div className="px-4 mb-2">
        <div className="rounded-2xl p-3 min-h-[64px]" style={{background:'rgba(0,0,0,0.4)',border:'1px solid rgba(212,160,23,0.2)'}}>
          <p className="text-[9px] text-primary font-black tracking-widest text-center mb-2">BOLAS EXTRAÍDAS</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {drawn.map((n,i)=><Ball key={i} number={n} isDrawn isMatch={picked.includes(n)} size="sm"/>)}
            {drawn.length===0&&<p className="text-muted-foreground text-xs">—</p>}
          </div>
        </div>
      </div>
      <div className="px-4 mb-2 h-8 flex items-center justify-center">
        <AnimatePresence>
          {outcome&&!drawing&&(
            <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
              className={`px-6 py-1 rounded-full text-sm font-bold ${outcome.won?'bg-green-500/20 text-green-400 border border-green-500/40':'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {outcome.won?`🎉 ${outcome.matches} aciertos · +${outcome.payout.toLocaleString()} TOKENS`:`😔 Solo ${outcome.matches} aciertos`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="px-3 flex-1">
        <div className="rounded-2xl overflow-hidden" style={{background:'linear-gradient(180deg,#1a6b2e,#145923)',border:'3px solid #8B6914',boxShadow:'0 0 0 2px #d4a017'}}>
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-black text-xs tracking-widest">TUS NÚMEROS ({picked.length}/{PICK_COUNT})</span>
              {outcome&&<button onClick={reset} className="text-[10px] text-primary font-bold underline">Nueva partida</button>}
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({length:TOTAL_BALLS},(_,i)=>i+1).map(n=>{
                const isPicked=picked.includes(n)
                const isMatch=outcome&&isPicked&&drawn.includes(n)
                return (
                  <button key={n} onClick={()=>togglePick(n)} disabled={drawing||(picked.length>=PICK_COUNT&&!isPicked)}
                    className={`w-6 h-6 rounded-md text-[10px] font-black transition-all active:scale-90 ${isMatch?'ring-2 ring-yellow-400':isPicked?'ring-1 ring-primary/60':''}`}
                    style={{
                      background:isMatch?'radial-gradient(circle,#fde68a,#d4a017)':isPicked?'rgba(212,160,23,0.35)':'rgba(0,0,0,0.3)',
                      border:isPicked?'1px solid rgba(212,160,23,0.6)':'1px solid rgba(255,255,255,0.15)',
                      color:isPicked?'#f6d365':'rgba(255,255,255,0.7)',
                    }}>{n}</button>
                )
              })}
            </div>
          </div>
          <div className="px-3 pb-2">
            <p className="text-center text-white text-[10px] font-black tracking-widest mb-2 opacity-80">TOKENS A APOSTAR</p>
            <div className="flex items-center justify-center gap-2">
              {[-10,-5].map(d=>(<button key={d} onClick={()=>changeBet(d)} disabled={drawing}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">{d}</button>))}
              <div className="px-4 py-1.5 rounded-lg border-2 border-white/50 bg-green-900/60 min-w-[60px] text-center">
                <span className="text-white font-black text-sm">{betAmount}</span>
              </div>
              {[5,10].map(d=>(<button key={d} onClick={()=>changeBet(d)} disabled={drawing}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">+{d}</button>))}
            </div>
          </div>
          <div className="px-4 pb-4 pt-1">
            <button onClick={drawNumbers} disabled={drawing||picked.length<PICK_COUNT||!player||betAmount>(player?.tokens||0)}
              className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95 disabled:opacity-40"
              style={{background:drawing?'#333':'linear-gradient(180deg,#2a2a2a,#111)',border:'2px solid rgba(255,255,255,0.15)'}}>
              {drawing?'🎱 SORTEANDO...':picked.length<PICK_COUNT?`ELIGE ${PICK_COUNT-picked.length} MÁS`:'SORTEAR'}
            </button>
          </div>
        </div>
      </div>
      <div className="h-4"/>
    </div>
  )
}
