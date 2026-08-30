import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, dailyRewardsDB } from '@/lib/db'
import { ArrowLeft, CheckCircle, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Avatar from '@/components/Avatar'

const TOTAL_DAYS = 30
const getDayReward = (day) => day * 10

export default function DailyReward() {
  const [player, setPlayer] = useState(null)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => { loadPlayer() }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const lastClaimStr = player?.last_daily_claim?.split('T')[0]

  const isAlreadyClaimed = lastClaimStr === todayStr

  const getDisplayDay = (p) => {
    if (!p) return 1
    if (!p.last_daily_claim) return p.daily_streak || 1
    if (lastClaimStr !== todayStr && lastClaimStr !== yesterdayStr) return 1
    return p.daily_streak || 1
  }

  const currentDay = getDisplayDay(player)

  const claimDaily = async () => {
    if (!player || claiming || isAlreadyClaimed) return
    setClaiming(true)

    let dayToClaim = player.daily_streak || 1
    if (player.last_daily_claim && lastClaimStr !== yesterdayStr && lastClaimStr !== todayStr) dayToClaim = 1
    if (!player.last_daily_claim) dayToClaim = 1

    const reward = getDayReward(dayToClaim)
    const nextDay = dayToClaim >= TOTAL_DAYS ? 1 : dayToClaim + 1
    const pointsEarned = Math.floor(reward / 2)

    const updated = await userDB.update(player.id, {
      tokens: player.tokens + reward,
      points: (player.points || 0) + pointsEarned,
      weekly_points: (player.weekly_points || 0) + pointsEarned,
      last_daily_claim: new Date().toISOString(),
      daily_streak: nextDay,
    })

    await dailyRewardsDB.claim({ userId: player.id, day: dayToClaim, rewardAmount: reward })

    setPlayer(updated)
    setClaiming(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0d0a00 0%, #0d0704 100%)' }}>
      {/* Header estandarizado (igual al resto de la app) */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link to="/" className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <Avatar src={player?.photo_url} name={player?.username || player?.first_name} size={40} />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-foreground truncate">{player?.username || player?.first_name || 'Jugador'}</h1>
          <p className="text-[10px] text-muted-foreground font-bold">{(player?.weekly_points || 0).toLocaleString()} PTS</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">TOKENS</div>
          <div className="text-base font-black text-primary">{(player?.tokens || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Título de la página (antes vivía dentro del header) */}
      <div className="px-4 pb-2">
        <h2 className="text-2xl font-black text-foreground">Recompensa Diaria</h2>
        <p className="text-xs text-muted-foreground">Reclama cada día sin fallar</p>
      </div>

      <div className="px-4 mb-4">
        <div className="rounded-2xl p-4 text-center" style={{
          background: 'linear-gradient(135deg, #1a1200, #0d0900)',
          border: '2px solid rgba(212,160,23,0.4)',
          boxShadow: '0 0 20px rgba(212,160,23,0.15)',
        }}>
          <p className="text-xs text-muted-foreground font-bold tracking-widest mb-1">DÍA ACTUAL</p>
          <div className="text-5xl font-black mb-1" style={{
            background: 'linear-gradient(180deg, #f6d365, #d4a017)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>{currentDay}</div>
          <p className="text-sm text-white/70 font-bold">
            Recompensa: <span className="text-primary font-black">{getDayReward(currentDay).toLocaleString()} TOKENS</span>
          </p>
          {isAlreadyClaimed ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-green-400 font-black text-sm">
              <CheckCircle size={18} /><span>¡YA RECLAMASTE HOY!</span>
            </div>
          ) : (
            <motion.button whileTap={{ scale: 0.95 }} onClick={claimDaily} disabled={claiming}
              className="mt-3 w-full py-3 rounded-xl font-black text-sm tracking-widest disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #f6d365, #d4a017)', color: '#1a0e05' }}>
              {claiming ? '⏳ RECLAMANDO...' : `🎁 RECLAMAR ${getDayReward(currentDay)} TOKENS`}
            </motion.button>
          )}
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <span className="text-red-400 text-sm mt-0.5">⚠️</span>
          <p className="text-xs text-red-400/80">Si fallas un día, la racha se reinicia al Día 1.</p>
        </div>
      </div>

      <div className="px-4 pb-6">
        <p className="text-xs font-black text-white/50 tracking-widest text-center mb-3">CALENDARIO DE 30 DÍAS</p>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: TOTAL_DAYS }, (_, i) => {
            const day = i + 1
            const reward = getDayReward(day)
            const isPast = day < currentDay
            const isCurrent = day === currentDay
            const isFuture = day > currentDay
            return (
              <div key={day} className="rounded-xl text-center relative" style={{
                height: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: isCurrent ? 'linear-gradient(135deg, #1a1200, #0d0900)' : isPast ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                border: isCurrent ? '2px solid rgba(212,160,23,0.6)' : isPast ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.08)',
                boxShadow: isCurrent ? '0 0 12px rgba(212,160,23,0.2)' : 'none',
              }}>
                {isPast && !isCurrent && <div className="absolute top-1 right-1"><CheckCircle size={9} className="text-green-500" /></div>}
                {isFuture && <div className="absolute top-1 right-1"><Lock size={8} className="text-white/20" /></div>}
                <p className="text-[9px] font-black leading-none" style={{ color: isCurrent ? '#f6d365' : isPast ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>D{day}</p>
                <p className="text-[10px] font-black leading-none mt-0.5" style={{ color: isCurrent ? '#f6d365' : isPast ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>{reward}</p>
              </div>
            )
          })}
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-3">Recompensas de 10 a 300 TOKENS · Tras el día 30 se reinician</p>
      </div>
    </div>
  )
}
