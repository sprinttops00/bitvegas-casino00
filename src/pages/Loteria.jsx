import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB, boostDB } from '@/lib/db'
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
  const [picked, setPicked] = useState([])
  const [drawn, setDrawn] = useState([])
  const [drawing, setDrawing] = useState(false)
  const [betAmount, setBetAmount] = useState(100)
  const [outcome, setOutcome] = useState(null)

  useEffect(() => { loadPlayer() }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  const toggleNumber = (n) => {
    if (drawing) return
    if (picked.includes(n)) setPicked(p => p.filter(x => x !== n))
    else if (picked.length < PICK_COUNT) setPicked(p => [...p, n])
  }

  const autoPick = () => {
    if (drawing) return
    const all = Array.from({length:TOTAL_BALLS},(_,i)=>i+1)
    const shuffled = all.sort(()=>Math.random()-0.5).slice(0,PICK_COUNT)
    setPicked(shuffled)
  }

  const play = async () => {
    if (!player || drawing || picked.length < PICK_COUNT || betAmount > player.tokens) return
    setDrawing(true); setDrawn([]); setOutcome(null)

    const all = Array.from({length:TOTAL_BALLS},(_,i)=>i+1)
    const shuffled = all.sort(()=>Math.random()-0.5).slice(0,DRAW_COUNT)

    for (let i=0;i<shuffled.length;i++) {
      await new Promise(r=>setTimeout(r,400))
      setDrawn(prev=>[...prev,shuffled[i]])
    }
    await new Promise(r=>setTimeout(r,300))
    const matches=picked.filter(n=>shuffled.includes(n)).length
    const prize=PRIZE_TABLE.find(p=>p.matches===matches)
    const won=!!prize
    const rawPayout=won?betAmount*prize.mult:0

    // Procesar potenciadores activos
    const { finalPayout, finalPoints, shieldUsed } = await boostDB.processGameBoosts({
      userId: player.id,
      won,
      betAmount,
      basePayout: rawPayout,
      basePoints: won ? 45 : 5,
    })

    const newTokens=player.tokens-betAmount+finalPayout
    setOutcome({won,payout: finalPayout,matches,drawn:shuffled,shieldUsed})
    setDrawing(false)

    const updated = await userDB.update(player.id, {
      tokens: newTokens,
      points: (player.points || 0) + finalPoints,
    })
    setPlayer(updated)

    await gameHistoryDB.create({
      userId: player.id,
      gameType: 'lottery',
      betAmount,
      result: { matches, drawn: shuffled, picked },
      winAmount: finalPayout,
      profit: finalPayout - betAmount,
      gameDetails: { prize: prize?.label, shieldUsed },
    })

    await statsDB.recordGame({
      userId: player.id,
      won: won || shieldUsed,
      payout: finalPayout,
      betAmount,
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
              className={`px-4 py-1 rounded-full text-xs font-black ${outcome.won?'bg-green-500/20 text-green-400 border border-green-500/30':outcome.shieldUsed?'bg-blue-500/20 text-blue-300 border border-blue-500/30':'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
              {outcome.won?`🎉 ¡${outcome.matches} ACIERTOS! +${outcome.payout.toLocaleString()} TOKENS`:outcome.shieldUsed?`🛡️ ¡Escudo activado! Apuesta protegida.`:`${outcome.matches} aciertos · -${betAmount.toLocaleString()} TOKENS`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="px-3 flex-1 flex flex-col justify-end mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] text-muted-foreground font-bold">{picked.length}/{PICK_COUNT} SELECCIONADOS</span>
          <div className="flex gap-2">
            <button onClick={autoPick} disabled={drawing} className="text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg active:scale-95">AL AZAR</button>
            <button onClick={reset} disabled={drawing} className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg active:scale-95">LIMPIAR</button>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({length:TOTAL_BALLS},(_,i)=>i+1).map(n=>{
            const isPicked=picked.includes(n)
            const isDrawn=drawn.includes(n)
            const isMatch=isPicked&&isDrawn
            return (
              <button key={n} onClick={()=>toggleNumber(n)} disabled={drawing}
                className={`h-9 rounded-xl font-black text-xs border transition-all active:scale-95 ${
                  isMatch?'bg-primary text-primary-foreground border-yellow-300 shadow-md':
                  isPicked?'bg-yellow-500/30 text-yellow-300 border-yellow-500/60':
                  isDrawn?'bg-blue-500/20 text-blue-300 border-blue-500/40':
                  'bg-secondary/60 text-muted-foreground border-border'
                }`}>
                {n}
              </button>
            )
          })}
        </div>
      </div>
      <div className="px-3 pb-6 space-y-3">
        <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-2">
          <button onClick={()=>changeBet(-50)} disabled={drawing} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95 disabled:opacity-50">-50</button>
          <div className="text-center"><span className="text-[10px] text-muted-foreground block">APUESTA</span><span className="text-base font-black text-primary">{betAmount.toLocaleString()} TKN</span></div>
          <button onClick={()=>changeBet(50)} disabled={drawing} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95 disabled:opacity-50">+50</button>
        </div>
        <button onClick={play} disabled={drawing||picked.length<PICK_COUNT||(player?.tokens||0)<betAmount}
          className="w-full py-4 rounded-2xl font-black text-base btn-gold shadow-lg tracking-wider active:scale-95 transition-all disabled:opacity-40">
          {drawing?'SORTEANDO...':picked.length<PICK_COUNT?`ELIGE ${PICK_COUNT-picked.length} NÚMEROS MÁS`:'JUGAR LOTERÍA'}
        </button>
      </div>
    </div>
  )
}
