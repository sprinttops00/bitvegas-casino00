import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, statsDB } from '@/lib/db'
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
      <div className="grid grid-cols-3 gap-1 p-1.5">
        {face.flat().map((dot,i)=>(
          <div key={i} className="w-2 h-2 rounded-full" style={{background:dot?'#1a0a02':'transparent'}} />
        ))}
      </div>
    </motion.div>
  )
}

function checkWin(betId, sum) {
  if (betId==='low') return sum>=2&&sum<=6
  if (betId==='high') return sum>=8&&sum<=12
  if (betId==='lucky7') return sum===7
  if (betId==='even') return sum%2===0
  if (betId==='odd') return sum%2!==0
  return false
}

export default function Dados() {
  const [player, setPlayer] = useState(null)
  const [selectedBet, setSelectedBet] = useState('high')
  const [betAmount, setBetAmount] = useState(100)
  const [rolling, setRolling] = useState(false)
  const [dice, setDice] = useState([1,1])
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
      const payout=won?Math.floor(betAmount*bet.payout):0
      const newTokens=player.tokens-betAmount+payout
      setOutcome({won,payout,sum})
      const newStreak = won ? (player.user_statistics?.current_streak || 0) + 1 : 0
      const newBestStreak = Math.max(player.user_statistics?.best_streak || 0, newStreak)

      const updated = await userDB.update(player.id, {
        tokens: newTokens,
        points: (player.points || 0) + (won ? 30 : 3),
      })
      setPlayer(updated)

      await gameHistoryDB.create({
        userId: player.id,
        gameType: 'dados',
        betAmount,
        result: { dice: [d1,d2], sum },
        winAmount: payout,
        profit: payout - betAmount,
        gameDetails: { betType: selectedBet },
      })

      await statsDB.update(player.id, {
        total_games_played: (player.user_statistics?.total_games_played || 0) + 1,
        total_wins: (player.user_statistics?.total_wins || 0) + (won ? 1 : 0),
        total_losses: (player.user_statistics?.total_losses || 0) + (won ? 0 : betAmount),
        biggest_win: Math.max(player.user_statistics?.biggest_win || 0, won ? payout : 0),
        current_streak: newStreak,
        best_streak: newBestStreak,
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
            <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
              className={`px-6 py-1 rounded-full text-sm font-bold ${outcome.won?'bg-green-500/20 text-green-400 border border-green-500/40':'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
              {outcome.won?`🎉 +${outcome.payout.toLocaleString()} TOKENS`:`😔 -${betAmount.toLocaleString()} TOKENS`} · Suma: {outcome.sum}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="px-3 flex-1">
        <div className="rounded-2xl overflow-hidden" style={{background:'linear-gradient(180deg,#1a6b2e,#145923)',border:'3px solid #8B6914',boxShadow:'0 0 0 2px #d4a017'}}>
          <div className="text-center pt-3 pb-2"><span className="text-white font-black tracking-widest text-base">APUESTA</span></div>
          <div className={`px-3 mb-3 grid grid-cols-3 gap-1.5 ${rolling ? 'pointer-events-none opacity-50' : ''}`}>
            {BET_OPTIONS.map(opt=>(
              <button key={opt.id} onClick={()=>setSelectedBet(opt.id)}
                className={`py-3 rounded-xl border text-white font-black text-xs transition-all active:scale-95 ${selectedBet===opt.id?'ring-2 ring-yellow-400':'opacity-80'}`}
                style={{background:selectedBet===opt.id?'rgba(212,160,23,0.25)':'rgba(0,0,0,0.25)',borderColor:'rgba(255,255,255,0.2)'}}>
                <div className="text-lg">{opt.label}</div>
                <div className="text-[9px] opacity-70 mt-0.5">{opt.desc} · x{opt.payout}</div>
              </button>
            ))}
          </div>
          <div className="px-3 pb-2">
            <p className="text-center text-white text-[10px] font-black tracking-widest mb-2 opacity-80">TOKENS A APOSTAR</p>
            <div className="flex items-center justify-center gap-2">
              {[-10,-5].map(d=>(<button key={d} onClick={()=>changeBet(d)} disabled={rolling}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">{d}</button>))}
              <div className="px-4 py-1.5 rounded-lg border-2 border-white/50 bg-green-900/60 min-w-[60px] text-center">
                <span className="text-white font-black text-sm">{betAmount}</span>
              </div>
              {[5,10].map(d=>(<button key={d} onClick={()=>changeBet(d)} disabled={rolling}
                  className="text-white text-xs font-bold bg-green-800/60 border border-white/20 rounded-lg px-2 py-1.5 active:scale-95 disabled:opacity-40">+{d}</button>))}
            </div>
          </div>
          <div className="px-4 pb-4 pt-1">
            <button onClick={roll} disabled={rolling||!player||betAmount>(player?.tokens||0)}
              className="w-full py-3.5 rounded-2xl text-white font-black text-lg tracking-widest active:scale-95 disabled:opacity-40"
              style={{background:rolling?'#333':'linear-gradient(180deg,#2a2a2a,#111)',border:'2px solid rgba(255,255,255,0.15)'}}>
              {rolling?'🎲 LANZANDO...':'LANZAR'}
            </button>
          </div>
        </div>
      </div>
      <div className="h-4"/>
    </div>
  )
}
