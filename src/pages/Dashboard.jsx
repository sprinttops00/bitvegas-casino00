import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, gameHistoryDB } from '@/lib/db'
import { TrendingUp, Zap, Trophy, Coins, Target } from 'lucide-react'

export default function Dashboard() {
  const [player, setPlayer] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) {
      setPlayer(u)
      const h = await gameHistoryDB.getByUserId(u.id, 20)
      setHistory(h)
    }
  }

  const stats = player?.user_statistics || {}
  const totalGames = stats.total_games_played || 0
  const winRate = totalGames > 0 ? Math.round(((stats.total_winnings || 0) / totalGames) * 100) : 0

  const statCards = [
    { label: 'Balance', value: `${(player?.tokens || 0).toLocaleString()} TKN`, icon: Coins, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Ganados', value: `+${(stats.total_winnings || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Perdidos', value: (stats.total_losses || 0).toLocaleString(), icon: Zap, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Win Rate', value: `${winRate}%`, icon: Target, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Partidas', value: totalGames, icon: Trophy, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Puntos', value: (player?.weekly_points || 0).toLocaleString(), icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
  ]

  return (
    <div className="min-h-screen px-4 pt-6 pb-24">
      <h1 className="text-2xl font-black text-foreground mb-4">Dashboard</h1>
      <div className="rounded-2xl p-4 text-center border border-primary/20 mb-4" style={{ background: 'rgba(212,160,23,0.08)' }}>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Tu progreso</p>
        <p className="text-3xl font-black mt-1 text-primary">{(player?.points || 0).toLocaleString()} PTS</p>
        <p className="text-xs text-muted-foreground mt-1">{totalGames} partidas · mayor win: {(stats.biggest_win || 0).toLocaleString()}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card rounded-xl p-3" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
              <Icon size={15} className={color} />
            </div>
            <p className="text-sm font-bold text-foreground truncate">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Últimas partidas</h2>
      {history.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Sin partidas aún. ¡Ve a jugar!</div>
      ) : (
        <div className="space-y-2">
          {history.map(h => (
            <div key={h.id} className="bg-card rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${h.win_amount > 0 ? 'bg-green-500/20' : 'bg-red-500/10'}`}>
                {h.game_type === 'roulette' ? '🎡' : h.game_type === 'highlow' ? '🔢' : h.game_type === 'crash' ? '🚀' : h.game_type === 'dados' ? '🎲' : h.game_type === 'slots' ? '🎰' : '🎱'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground capitalize">{h.game_type}</p>
                <p className="text-[10px] text-muted-foreground">Apuesta: {h.bet_amount?.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${h.win_amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {h.win_amount > 0 ? `+${h.win_amount?.toLocaleString()}` : `-${h.bet_amount?.toLocaleString()}`}
                </p>
                <p className="text-[10px] text-muted-foreground">TOKENS</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
