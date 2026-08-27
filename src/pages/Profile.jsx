import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB, withdrawalDB, referralDB } from '@/lib/db'
import { ArrowLeft, Copy, Check, Users, TrendingUp, Coins, Trophy, Target, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Avatar from '@/components/Avatar'

export default function Profile() {
  const [player, setPlayer] = useState(null)
  const [tgUser, setTgUser] = useState(null)
  const [history, setHistory] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [referrals, setReferrals] = useState([])
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState('stats')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const u = getCurrentUser()
    setTgUser(u)
    const p = await userDB.findByTelegramId(u.telegram_id)
    if (p) {
      setPlayer(p)
      const [h, w, r] = await Promise.all([
        gameHistoryDB.getByUserId(p.id, 50),
        withdrawalDB.getByUserId(p.id, 20),
        referralDB.getByReferrer(p.id),
      ])
      setHistory(h)
      setWithdrawals(w)
      setReferrals(r)
    }
  }

  const referralLink = player ? `https://t.me/casinobot?start=${player.referral_code}` : ''

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const stats = player?.user_statistics || {}
  const totalGames = stats.total_games_played || 0
  const totalWins = stats.total_wins || 0
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

  const statusColor = (s) => s === 'completed' ? 'text-green-400' : s === 'failed' ? 'text-red-400' : 'text-yellow-400'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #1a0e05 0%, #0d0704 100%)' }}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <Link to="/" className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <Avatar src={player?.photo_url} name={player?.username || player?.first_name} size={48} />
          <div>
            <h1 className="text-lg font-black text-foreground">{player?.username || player?.first_name || '...'}</h1>
            <p className="text-xs text-muted-foreground">{(player?.weekly_points || 0).toLocaleString()} PTS</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">TOKENS</div>
          <div className="text-base font-black text-primary">{(player?.tokens || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex rounded-2xl overflow-hidden border border-border" style={{ background: 'rgba(0,0,0,0.3)' }}>
          {[
            { id: 'stats', label: '📊 Stats' },
            { id: 'referrals', label: '👥 Referidos' },
            { id: 'history', label: '🎮 Historial' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-black transition-all ${tab === t.id ? 'text-primary' : 'text-muted-foreground'}`}
              style={{ background: tab === t.id ? 'rgba(212,160,23,0.15)' : 'transparent', borderBottom: tab === t.id ? '2px solid #d4a017' : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 flex-1 pb-6">
        {tab === 'stats' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="rounded-2xl p-4 text-center border border-primary/30" style={{ background: 'rgba(212,160,23,0.08)' }}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Partidas jugadas</p>
              <p className="text-3xl font-black mt-1 text-primary">{totalGames}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Win Rate', value: `${winRate}%`, icon: Target, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                { label: 'Mejor racha', value: stats.best_streak || 0, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
                { label: 'Total ganado', value: `${(stats.total_winnings || 0).toLocaleString()} TKN`, icon: Coins, color: 'text-green-400', bg: 'bg-green-500/10' },
                { label: 'Mayor win', value: `${(stats.biggest_win || 0).toLocaleString()} TKN`, icon: Trophy, color: 'text-accent', bg: 'bg-accent/10' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-card rounded-xl p-3 flex items-center gap-3" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon size={15} className={color} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Withdrawals history */}
            <div className="bg-card rounded-xl p-4" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3">Retiros</h3>
              {withdrawals.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Sin retiros aún</p>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map(w => (
                    <div key={w.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-foreground">{w.token_amount?.toLocaleString()} TKN → {w.ton_amount} TON</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-[10px] font-bold ${statusColor(w.status)}`}>{w.status.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === 'referrals' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, rgba(212,160,23,0.15), rgba(212,160,23,0.05))', border: '1px solid rgba(212,160,23,0.3)' }}>
              <div className="text-3xl mb-2">👥</div>
              <h2 className="text-lg font-black text-foreground mb-1">Programa de Referidos</h2>
              <p className="text-xs text-muted-foreground">Invita amigos y gana <span className="text-primary font-bold">200 TOKENS</span> por cada uno</p>
            </div>
            <div className="bg-card rounded-2xl p-4" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3">Tu enlace único</p>
              <div className="flex items-center gap-2 bg-secondary/60 rounded-xl px-3 py-2.5 border border-border">
                <p className="flex-1 text-xs text-foreground font-mono truncate">{referralLink}</p>
                <button onClick={copyReferral} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95"
                  style={{ background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(212,160,23,0.2)' }}>
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-primary" />}
                </button>
              </div>
              <button onClick={copyReferral} className="w-full mt-3 py-3 rounded-xl text-sm font-black tracking-wider transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #f6d365, #d4a017)', color: '#1a0e05' }}>
                {copied ? '✅ ¡Enlace Copiado!' : '📋 Copiar Enlace'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl p-4 text-center" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
                <Users size={20} className="text-primary mx-auto mb-1" />
                <p className="text-2xl font-black text-foreground">{referrals.length}</p>
                <p className="text-[10px] text-muted-foreground">Referidos</p>
              </div>
              <div className="bg-card rounded-xl p-4 text-center" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
                <Coins size={20} className="text-primary mx-auto mb-1" />
                <p className="text-2xl font-black text-foreground">{referrals.length * 200}</p>
                <p className="text-[10px] text-muted-foreground">TOKENS ganados</p>
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'history' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {history.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Clock size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin partidas aún. ¡Ve a jugar!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="bg-card rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${h.win_amount > 0 ? 'bg-green-500/20' : 'bg-red-500/10'}`}>
                      {h.game_type === 'roulette' ? '🎡' : h.game_type === 'highlow' ? '🔢' : h.game_type === 'crash' ? '🚀' : h.game_type === 'dados' ? '🎲' : h.game_type === 'slots' ? '🎰' : '🎱'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground capitalize">{h.game_type}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${h.win_amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {h.win_amount > 0 ? `+${h.win_amount?.toLocaleString()}` : `-${h.bet_amount?.toLocaleString()}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">TOKENS</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
