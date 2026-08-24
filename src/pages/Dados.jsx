import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB, boostDB } from '@/lib/db'
import { motion, AnimatePresence } from 'framer-motion'
import GameHeader from '@/components/GameHeader'

const BET_OPTIONS = [
  { id: 'low', label: '2–6', desc: 'Bajo', payout: 2 },
  { id: 'high', label: '8–12', desc: 'Alto', payout: 2 },
  { id: 'lucky7', label: '7', desc: 'Lucky 7', payout: 4 },
  { id: 'even', label: 'PAR', desc: 'Par', payout: 2 },
  { id: 'odd', label: 'IMPAR', desc: 'Impar', payout: 2 },
]

const INFO = [
  '🎲 Se lanzan 2 dados. La suma puede ser del 2 al 12.',
  '📉 Bajo (2-6): ganas x2.',
  '📈 Alto (8-12): ganas x2.',
  '7️⃣ Lucky 7: ganas x4.',
  '🔢 Par/Impar: ganas x2.',
]

const DIE_FACES = {
  1:[[0,0,0],[0,1,0],[0,0,0]],2:[[1,0,0],[0,0,0],[0,0,1]],
  3:[[1,0,0],[0,1,0],[0,0,1]],4:[[1,0,1],[0,0,0],[1,0,1]],
  5:[[1,0,1],[0,1,0],[1,0,1]],6:[[1,0,1],[1,0,1],[1,0,1]],
}

function Die({ value, rolling }) {
  const face = DIE_FACES[value] || DIE_FACES[1]
  return (
    <motion.div animate={rolling?{rotate:[0,90,180,270,360],scale:[1,1.1,0.9,1.1,1]}:{}}
      transition={{duration:0.5,repeat:rolling?Infinity:0}}
      className="w-16 h-16 rounded-xl flex items-center justify-center"
      style={{ background:'linear-gradient(135deg,#f5f5dc,#e8e0c8 50%,#d4c9a8)', boxShadow:'3px 3px 8px rgba(0,0,0,0.5),inset -2px -2px 4px rgba(0,0,0,0.15)', border:'2px solid #c4b88a' }}>
      <div className="grid grid-cols-3 gap-1 p-2 w-full h-full">
        {face.flat().map((dot, i) => (
          <div key={i} className="flex items-center justify-center">
            {dot === 1 && <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 shadow-inner" />}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function checkWin(betId, sum) {
  if (betId === 'low') return sum >= 2 && sum <= 6
  if (betId === 'high') return sum >= 8 && sum <= 12
  if (betId === 'lucky7') return sum === 7
  if (betId === 'even') return sum % 2 === 0
  if (betId === 'odd') return sum % 2 !== 0
  return false
}

export default function Dados() {
  const [player, setPlayer] = useState(null)
  const [selectedBet, setSelectedBet] = useState('lucky7')
  const [betAmount, setBetAmount] = useState(100)
  const [rolling, setRolling] = useState(false)
  const [dice, setDice] = useState([3, 4])
  const [outcome, setOutcome] = useState(null)

  useEffect(() => { loadPlayer() }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  const roll = async () => {
    if (!player || rolling || betAmount > player.tokens) return
    setRolling(true); setOutcome(null)
    const d1=Math.floor(Math.random()*6)+1, d2=Math.floor(Math.random()*6)+1
    setTimeout(async () => {
      setDice([d1,d2])
      const sum=d1+d2
      const bet=BET_OPTIONS.find(b=>b.id===selectedBet)
      const won=checkWin(selectedBet,sum)
      const rawPayout=won?Math.floor(betAmount*bet.payout):0

      // Procesar potenciadores activos
      const { finalPayout, finalPoints, shieldUsed } = await boostDB.processGameBoosts({
        userId: player.id,
        won,
        betAmount,
        basePayout: rawPayout,
        basePoints: won ? 30 : 3,
      })

      const newTokens=player.tokens-betAmount+finalPayout
      setOutcome({won,payout: finalPayout,sum,shieldUsed})

      const updated = await userDB.update(player.id, {
        tokens: newTokens,
        points: (player.points || 0) + finalPoints,
      })
      setPlayer(updated)

      await gameHistoryDB.create({
        userId: player.id,
        gameType: 'dados',
        betAmount,
        result: { dice: [d1,d2], sum },
        winAmount: finalPayout,
        profit: finalPayout - betAmount,
        gameDetails: { betType: selectedBet, shieldUsed },
      })

      await statsDB.recordGame({
        userId: player.id,
        won: won || shieldUsed,
        payout: finalPayout,
        betAmount,
      })

      setRolling(false)
    }, 1800)
  }

  const changeBet = (d) => setBetAmount(p => Math.max(10, Math.min(player?.tokens||0, p+d)))

  return (
    <div className="min-h-screen flex flex-col" style={{background:'linear-gradient(180deg,#1a0e05,#0d0704)'}}>
      <GameHeader title="DADOS" balance={player?.tokens} infoTitle="Cómo jugar Dados" infoContent={INFO} />
      <div className="flex justify-center items-center gap-6 py-4">
        <Die value={dice[0]} rolling={rolling} />
        <div className="text-2xl font-black text-primary/60">+</div>
        <Die value={dice[1]} rolling={rolling} />
      </div>
      <div className="px-4 mb-2 h-8 flex items-center justify-center">
        <AnimatePresence>
          {outcome && !rolling && (
            <motion.div initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
              className={`px-4 py-1 rounded-full text-sm font-bold ${outcome.won?'text-green-400':outcome.shieldUsed?'text-blue-300':'text-red-400'}`}>
              {outcome.won?`🎉 Suma: ${outcome.sum} · +${outcome.payout.toLocaleString()} TOKENS`:outcome.shieldUsed?`🛡️ Suma: ${outcome.sum} · ¡Escudo salvó tu apuesta!`: `😔 Suma: ${outcome.sum} · -${betAmount.toLocaleString()} TOKENS`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="px-3 flex-1 flex flex-col justify-end mb-3">
        <div className="grid grid-cols-3 gap-2">
          {BET_OPTIONS.map(b => (
            <button key={b.id} onClick={()=>setSelectedBet(b.id)} disabled={rolling}
              className={`py-3 px-2 rounded-xl text-center border transition-all active:scale-95 ${
                selectedBet===b.id?'bg-primary/20 border-primary text-primary':'bg-secondary/60 border-border text-foreground'
              }`}>
              <div className="font-black text-sm">{b.label}</div>
              <div className="text-[10px] text-muted-foreground">{b.desc} · x{b.payout}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 pb-6 space-y-3">
        <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-2">
          <button onClick={()=>changeBet(-50)} disabled={rolling} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95 disabled:opacity-50">-50</button>
          <div className="text-center"><span className="text-[10px] text-muted-foreground block">APUESTA</span><span className="text-base font-black text-primary">{betAmount.toLocaleString()} TKN</span></div>
          <button onClick={()=>changeBet(50)} disabled={rolling} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm active:scale-95 disabled:opacity-50">+50</button>
        </div>
        <button onClick={roll} disabled={rolling||(player?.tokens||0)<betAmount}
          className="w-full py-4 rounded-2xl font-black text-base btn-gold shadow-lg tracking-wider active:scale-95 transition-all">
          {rolling?'LANZANDO...':'LANZAR DADOS'}
        </button>
      </div>
    </div>
  )
}
