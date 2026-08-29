import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, jackpotDB } from '@/lib/db'
import { Crown, Medal, ArrowLeft, Coins, Info, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Avatar from '@/components/Avatar'

const RANKING_INFO = [
  '🏆 El Ranking se ordena por tus PUNTOS de esta semana — se reinician cada domingo, para que todos empiecen parejos.',
  '🎮 Ganas puntos jugando cualquiera de los 6 juegos. Mientras más juegues (y ganes), más puntos sumas y más subes en la tabla.',
  '💰 Cada vez que alguien pierde una apuesta (sin Escudo activo), esos tokens se van directo al Jackpot de la semana.',
  '⏳ Cada domingo a las 8:00 PM se reparte TODO el Jackpot entre el Top 3: 🥇 60% · 🥈 25% · 🥉 15%.',
  '🔁 Después del reparto, el Jackpot vuelve a 0 y el Ranking se reinicia — nueva semana, misma oportunidad para todos.',
  '🚀 ¡Mientras más juegues, más rápido crece el Jackpot y más puntos sumas para meterte en el Top 3! No te quedes fuera del reparto del domingo.',
]

// Calcula la próxima fecha/hora del reparto: domingo 8:00 PM, hora del Este de EE.UU.
// (se recalcula sola cada vez que se llama, así que apenas pasa el domingo, automáticamente
// "salta" al domingo siguiente sin que haya que resetear nada a mano).
function getNextPayoutDate() {
  const now = new Date()
  const easternNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const dayOfWeek = easternNow.getDay() // 0 = domingo
  let daysUntilSunday = (7 - dayOfWeek) % 7
  const target = new Date(easternNow)
  target.setDate(easternNow.getDate() + daysUntilSunday)
  target.setHours(20, 0, 0, 0)
  if (target <= easternNow) target.setDate(target.getDate() + 7)
  const diffLocalVsEastern = now.getTime() - easternNow.getTime()
  return new Date(target.getTime() + diffLocalVsEastern)
}

function useJackpotCountdown() {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const update = () => {
      const diff = getNextPayoutDate().getTime() - Date.now()
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(`${String(days).padStart(2, '0')} días, ${String(hours).padStart(2, '0')}h, ${String(minutes).padStart(2, '0')} min`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])
  return timeLeft
}

export default function Ranking() {
  const [players, setPlayers] = useState([])
  const [me, setMe] = useState(null)
  const [myRank, setMyRank] = useState(null)
  const [jackpot, setJackpot] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const countdown = useJackpotCountdown()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const tgUser = getCurrentUser()
    const all = await userDB.listAll('weekly_points', 50)
    setPlayers(all)
    const myP = all.find(p => p.telegram_id === tgUser.telegram_id)
    if (myP) {
      setMe(myP)
      setMyRank(all.findIndex(p => p.telegram_id === tgUser.telegram_id) + 1)
    }
    const currentJackpot = await jackpotDB.getCurrent()
    setJackpot(currentJackpot)
  }

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown size={16} className="text-yellow-400" />
    if (rank === 2) return <Medal size={16} className="text-slate-300" />
    if (rank === 3) return <Medal size={16} className="text-amber-600" />
    return <span className="text-xs text-muted-foreground font-bold">#{rank}</span>
  }

  const getRankBg = (rank) => {
    if (rank === 1) return 'bg-yellow-500/10 border-yellow-500/30'
    if (rank === 2) return 'bg-slate-400/10 border-slate-400/20'
    if (rank === 3) return 'bg-amber-600/10 border-amber-600/20'
    return 'bg-card border-border/50'
  }

  const JACKPOT_SPLITS = [0.60, 0.25, 0.15]

  return (
    <div className="min-h-screen pb-24">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link to="/" className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0"><ArrowLeft size={18}/></Link>
        <h1 className="text-xl font-black text-foreground flex-1">Ranking Semanal</h1>
        <button onClick={() => setShowInfo(true)}
          className="w-9 h-9 rounded-xl border border-primary/30 flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,160,23,0.12)' }}>
          <Info size={16} className="text-primary" />
        </button>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.8)' }}
            onClick={() => setShowInfo(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-6"
              style={{ background: 'linear-gradient(135deg, #1a1200, #0d0900)', border: '2px solid rgba(212,160,23,0.4)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-primary">📖 Cómo funciona el Ranking</h2>
                <button onClick={() => setShowInfo(false)} className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                {RANKING_INFO.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 mb-4">
        <div className="rounded-2xl p-4 text-center" style={{
          background: 'linear-gradient(180deg, rgba(212,160,23,0.15), rgba(212,160,23,0.05))',
          border: '1px solid rgba(212,160,23,0.35)',
        }}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Coins size={16} className="text-primary" />
            <p className="text-[10px] text-primary font-black tracking-widest">JACKPOT DE ESTA SEMANA</p>
          </div>
          <p className="text-2xl font-black text-primary">{jackpot.toLocaleString()} TOKENS</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Se reparte cada domingo 8:00 PM · 🥇 60% · 🥈 25% · 🥉 15%
          </p>
          <p className="text-xs font-black text-primary mt-2">
            ⏳ Quedan: {countdown}
          </p>
        </div>
      </div>

      {myRank && (
        <div className="px-4 mb-4">
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">{getRankIcon(myRank)}</div>
            <div>
              <p className="text-xs text-muted-foreground">Tu posición</p>
              <p className="text-sm font-bold text-foreground">#{myRank} · {me?.username || me?.first_name}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Puntos (semana)</p>
              <p className="text-sm font-bold text-primary">{(me?.weekly_points || 0).toLocaleString()} PTS</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pb-4 space-y-2">
        {players.map((p, index) => {
          const rank = index + 1
          const isMe = p.telegram_id === me?.telegram_id
          const potentialWin = rank <= 3 ? Math.floor(jackpot * JACKPOT_SPLITS[rank - 1]) : null
          return (
            <div key={p.id} className={`rounded-xl px-3 py-3 flex items-center gap-3 border transition-all ${getRankBg(rank)} ${isMe ? 'ring-1 ring-primary/40' : ''}`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-card/50">{getRankIcon(rank)}</div>
              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center">
                <Avatar src={p.photo_url} name={p.username || p.first_name} size={36} className="rounded-full border-0" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {p.username || p.first_name} {isMe && <span className="text-[10px] text-primary">(tú)</span>}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {potentialWin !== null ? `🏆 Ganaría ${potentialWin.toLocaleString()} tokens` : `${p.tokens?.toLocaleString()} tokens`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{(p.weekly_points || 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">PUNTOS</p>
              </div>
            </div>
          )
        })}
        {players.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">Sin jugadores aún.</div>}
      </div>
    </div>
  )
}
