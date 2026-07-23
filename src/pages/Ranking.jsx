import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB } from '@/lib/db'
import { Crown, Medal, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import Avatar from '@/components/Avatar'

export default function Ranking() {
  const [players, setPlayers] = useState([])
  const [me, setMe] = useState(null)
  const [myRank, setMyRank] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const tgUser = getCurrentUser()
    const all = await userDB.listAll('points', 50)
    setPlayers(all)
    const myP = all.find(p => p.telegram_id === tgUser.telegram_id)
    if (myP) {
      setMe(myP)
      setMyRank(all.findIndex(p => p.telegram_id === tgUser.telegram_id) + 1)
    }
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

  return (
    <div className="min-h-screen pb-24">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link to="/" className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0"><ArrowLeft size={18}/></Link>
        <h1 className="text-xl font-black text-foreground">Ranking Global</h1>
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
              <p className="text-xs text-muted-foreground">Puntos</p>
              <p className="text-sm font-bold text-primary">{(me?.points || 0).toLocaleString()} PTS</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pb-4 space-y-2">
        {players.map((p, index) => {
          const rank = index + 1
          const isMe = p.telegram_id === me?.telegram_id
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
                <p className="text-[10px] text-muted-foreground">{p.tokens?.toLocaleString()} tokens</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{(p.points || 0).toLocaleString()}</p>
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
