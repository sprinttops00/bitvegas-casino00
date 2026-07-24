import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, tasksDB, achievementsDB, referralDB } from '@/lib/db'
import { CheckCircle, Zap, ArrowLeft, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import Avatar from '@/components/Avatar'

export default function Tasks() {
  const [player, setPlayer] = useState(null)
  const [tasks, setTasks] = useState([])
  const [achievements, setAchievements] = useState([])
  const [completedTaskIds, setCompletedTaskIds] = useState([])
  const [completedAchievIds, setCompletedAchievIds] = useState([])
  const [referralCount, setReferralCount] = useState(0)
  const [claiming, setClaiming] = useState(null)
  const [tab, setTab] = useState('tareas')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (!u) return
    setPlayer(u)
    const [t, a, ct, ca, refs] = await Promise.all([
      tasksDB.getActive(),
      achievementsDB.getActive(),
      tasksDB.getCompletedByUser(u.id),
      achievementsDB.getUnlockedByUser(u.id),
      referralDB.getByReferrer(u.id),
    ])
    setTasks(t)
    setAchievements(a)
    setCompletedTaskIds(ct)
    setCompletedAchievIds(ca)
    setReferralCount(refs.length)
  }

  // Calcula el progreso real del jugador para una tarea o logro automático.
  // Devuelve { current, target, isComplete }.
  // Para tareas 'social' no hay progreso numérico (se reclama a mano).
  const getProgress = (item) => {
    const stats = player?.user_statistics || {}
    const target = Number(item.requirement) || 0
    let current = 0
    switch (item.type) {
      case 'games_played': current = stats.total_games_played || 0; break
      case 'games_won':    current = stats.total_wins || 0; break
      case 'total_winnings': current = stats.total_winnings || 0; break
      case 'best_streak':  current = stats.best_streak || 0; break
      case 'referral':     current = referralCount; break
      default: return { current: null, target: null, isComplete: false } // 'social'
    }
    return { current, target, isComplete: current >= target }
  }

  const claimTask = async (task) => {
    if (!player || claiming) return
    // Para tareas automáticas, verificar que realmente se cumple la condición
    if (task.type !== 'social') {
      const { isComplete } = getProgress(task)
      if (!isComplete) return
    }
    setClaiming(task.id)
    const updated = await userDB.update(player.id, {
      tokens: player.tokens + (task.token_reward || 0),
      points: (player.points || 0) + (task.points_reward || 0),
    })
    await tasksDB.complete({ userId: player.id, taskId: task.id })
    setPlayer(updated)
    setCompletedTaskIds(prev => [...prev, task.id])
    setClaiming(null)
  }

  // Para tareas de redes sociales: abrir el enlace y permitir reclamar
  const handleSocialTask = (task) => {
    if (!player || claiming) return
    if (task.requirement) {
      try { window.open(task.requirement, '_blank') } catch (_) {}
    }
    claimTask(task)
  }

  const claimAchievement = async (ach) => {
    if (!player || claiming) return
    const { isComplete } = getProgress(ach)
    if (!isComplete) return
    setClaiming(ach.id)
    const updated = await userDB.update(player.id, {
      tokens: player.tokens + (ach.token_reward || 0),
      points: (player.points || 0) + (ach.points_reward || 0),
    })
    await achievementsDB.unlock({ userId: player.id, achievementId: ach.id })
    setPlayer(updated)
    setCompletedAchievIds(prev => [...prev, ach.id])
    setClaiming(null)
  }

  const totalItems = tasks.length + achievements.length
  const completedCount = completedTaskIds.length + completedAchievIds.length

  return (
    <div className="min-h-screen pb-24">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link to="/" className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <Avatar src={player?.photo_url} name={player?.username || player?.first_name} size={40} />
        <div className="flex-1">
          <h1 className="text-lg font-black text-foreground">Tareas & Logros</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">TOKENS</div>
          <div className="text-base font-black text-primary">{(player?.tokens || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 mb-4">
        <div className="bg-card rounded-xl p-3" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-foreground">Progreso total</span>
            <span className="text-xs text-primary font-bold">{completedCount}/{totalItems}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-yellow-300 rounded-full transition-all duration-500"
              style={{ width: `${totalItems ? (completedCount / totalItems) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex rounded-xl overflow-hidden border border-border" style={{ background: 'rgba(0,0,0,0.3)' }}>
          {[{ id: 'tareas', label: '⚡ Tareas' }, { id: 'logros', label: '🏅 Logros' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-black transition-all ${tab === t.id ? 'text-primary' : 'text-muted-foreground'}`}
              style={{ background: tab === t.id ? 'rgba(212,160,23,0.15)' : 'transparent', borderBottom: tab === t.id ? '2px solid #d4a017' : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks list */}
      {tab === 'tareas' && (
        <div className="px-4 space-y-2">
          {tasks.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No hay tareas configuradas aún.</p>
          )}
          {tasks.map(task => {
            const done = completedTaskIds.includes(task.id)
            const isSocial = task.type === 'social'
            const { current, target, isComplete } = isSocial ? { current: null, target: null, isComplete: false } : getProgress(task)
            return (
              <div key={task.id} className={`bg-card rounded-xl px-3 py-3 flex items-center gap-3 ${done ? 'opacity-60' : ''}`}
                style={{ border: '1px solid rgba(212,160,23,0.15)', background: done ? 'rgba(34,197,94,0.06)' : undefined }}>
                <div className="text-sm w-5 text-center shrink-0">{done ? '✅' : (isSocial ? '🔗' : '🎯')}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{task.title}</p>
                  {task.description && <p className="text-[10px] text-muted-foreground">{task.description}</p>}
                  {!isSocial && !done && current !== null && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Progreso: <span className="text-primary font-bold">{Math.min(current, target).toLocaleString()}</span> / {target.toLocaleString()}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1">
                      <Zap size={9} className="text-primary" />
                      <span className="text-[10px] text-primary font-bold">+{task.token_reward} TKN</span>
                    </div>
                    {task.points_reward > 0 && <span className="text-[10px] text-accent font-bold">+{task.points_reward} PTS</span>}
                  </div>
                </div>
                {!done ? (
                  isSocial ? (
                    <button onClick={() => handleSocialTask(task)} disabled={claiming === task.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black btn-gold disabled:opacity-50 shrink-0">
                      {claiming === task.id ? '...' : 'Ir y Reclamar'}
                    </button>
                  ) : isComplete ? (
                    <button onClick={() => claimTask(task)} disabled={claiming === task.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black btn-gold disabled:opacity-50 shrink-0">
                      {claiming === task.id ? '...' : 'Reclamar'}
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black text-muted-foreground/60 shrink-0"
                      style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      <Lock size={10} className="inline" />
                    </span>
                  )
                ) : (
                  <CheckCircle size={14} className="text-green-400 shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Achievements list */}
      {tab === 'logros' && (
        <div className="px-4 space-y-2">
          {achievements.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No hay logros configurados aún.</p>
          )}
          {achievements.map(ach => {
            const done = completedAchievIds.includes(ach.id)
            const { current, target, isComplete } = getProgress(ach)
            return (
              <div key={ach.id} className={`bg-card rounded-xl px-3 py-3 flex items-center gap-3 ${done ? 'opacity-60' : ''}`}
                style={{ border: '1px solid rgba(212,160,23,0.15)', background: done ? 'rgba(34,197,94,0.06)' : undefined }}>
                <div className="text-sm w-5 text-center shrink-0">{done ? '✅' : '🏅'}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{ach.title}</p>
                  {ach.description && <p className="text-[10px] text-muted-foreground">{ach.description}</p>}
                  {!done && current !== null && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Progreso: <span className="text-primary font-bold">{Math.min(current, target).toLocaleString()}</span> / {target.toLocaleString()}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1">
                      <Zap size={9} className="text-primary" />
                      <span className="text-[10px] text-primary font-bold">+{ach.token_reward} TKN</span>
                    </div>
                    {ach.points_reward > 0 && <span className="text-[10px] text-accent font-bold">+{ach.points_reward} PTS</span>}
                  </div>
                </div>
                {!done ? (
                  isComplete ? (
                    <button onClick={() => claimAchievement(ach)} disabled={claiming === ach.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black btn-gold disabled:opacity-50 shrink-0">
                      {claiming === ach.id ? '...' : 'Reclamar'}
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black text-muted-foreground/60 shrink-0"
                      style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      <Lock size={10} className="inline" />
                    </span>
                  )
                ) : (
                  <CheckCircle size={14} className="text-green-400 shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
