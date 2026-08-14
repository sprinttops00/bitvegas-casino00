import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, tasksDB, achievementsDB, referralDB } from '@/lib/db'
import { Zap, ArrowLeft, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import Avatar from '@/components/Avatar'

// Categorías de tareas y logros. En cada categoría solo se muestra UNA
// tarea/logro a la vez (la actual de la cadena). Al reclamarla, aparece
// la siguiente. La última de la cadena queda fija e inhabilitada.
const TASK_CATEGORIES = ['social', 'referral', 'games_played', 'games_won']
const ACH_CATEGORIES = ['total_winnings', 'games_played', 'best_streak']

// Devuelve la tarea/logro "actual" de una cadena: la primera NO reclamada.
// Si ya se reclamaron todas, devuelve la última (se queda fija, "Reclamado").
function pickCurrent(items, completedIds) {
  const sorted = [...items].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
  if (sorted.length === 0) return null
  const firstPending = sorted.find(it => !completedIds.includes(it.id))
  if (firstPending) return { item: firstPending, allDone: false }
  return { item: sorted[sorted.length - 1], allDone: true }
}

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

  // Compara el requisito de una tarea/logro con las estadísticas REALES
  // del jugador (leídas de la base de datos). Si no cumple, no se puede
  // reclamar. Para 'social' no hay verificación numérica posible.
  const getProgress = (item) => {
    const stats = player?.user_statistics || {}
    const target = Number(item.requirement) || 0
    let current = 0
    switch (item.type) {
      case 'games_played': current = stats.total_games_played || 0; break
      case 'games_won': current = stats.total_wins || 0; break
      case 'total_winnings': current = stats.total_winnings || 0; break
      case 'best_streak': current = stats.best_streak || 0; break
      case 'referral': current = referralCount; break
      default: return { current: null, target: null, isComplete: false }
    }
    return { current, target, isComplete: current >= target }
  }

  const creditReward = async (rewardTokens, rewardPoints) => {
    const updated = await userDB.update(player.id, {
      tokens: player.tokens + (rewardTokens || 0),
      points: (player.points || 0) + (rewardPoints || 0),
    })
    setPlayer(updated)
  }

  const claimTask = async (task) => {
    if (!player || claiming) return
    if (completedTaskIds.includes(task.id)) return
    // VERIFICACIÓN REAL: las tareas automáticas solo se reclaman si el
    // jugador cumple el requisito según sus estadísticas reales.
    if (task.type !== 'social') {
      const { isComplete } = getProgress(task)
      if (!isComplete) return
    }
    setClaiming(task.id)
    await creditReward(task.token_reward, task.points_reward)
    await tasksDB.complete({ userId: player.id, taskId: task.id })
    setCompletedTaskIds(prev => [...prev, task.id])
    setClaiming(null)
  }

  // Tareas de redes sociales: abre el enlace y reclama (confianza manual).
  const handleSocialTask = (task) => {
    if (!player || claiming) return
    if (task.link) {
      try { window.open(task.link, '_blank') } catch (_) {}
    }
    claimTask(task)
  }

  const claimAchievement = async (ach) => {
    if (!player || claiming) return
    if (completedAchievIds.includes(ach.id)) return
    const { isComplete } = getProgress(ach)
    if (!isComplete) return
    setClaiming(ach.id)
    await creditReward(ach.token_reward, ach.points_reward)
    await achievementsDB.unlock({ userId: player.id, achievementId: ach.id })
    setCompletedAchievIds(prev => [...prev, ach.id])
    setClaiming(null)
  }

  const totalItems = tasks.length + achievements.length
  const completedCount = completedTaskIds.length + completedAchievIds.length

  // Sistema progresivo: la tarea/logro visible de cada categoría.
  const visibleTasks = TASK_CATEGORIES
    .map(cat => pickCurrent(tasks.filter(t => t.type === cat), completedTaskIds))
    .filter(Boolean)
  const visibleAchievements = ACH_CATEGORIES
    .map(cat => pickCurrent(achievements.filter(a => a.type === cat), completedAchievIds))
    .filter(Boolean)

  const claimedBadge = (
    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black text-green-400 shrink-0"
      style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
      Reclamado
    </span>
  )
  const lockedBadge = (
    <span className="px-2.5 py-1 rounded-lg shrink-0 flex items-center justify-center"
      style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.35)' }}>
      <Lock size={10} />
    </span>
  )

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

      {/* Tasks list (progresivo: una por categoría) */}
      {tab === 'tareas' && (
        <div className="px-4 space-y-2">
          {visibleTasks.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No hay tareas disponibles.</p>
          ) : visibleTasks.map(({ item: task, allDone }) => {
            const isSocial = task.type === 'social'
            const { current, target, isComplete } = getProgress(task)
            return (
              <div key={task.id} className={`bg-card rounded-xl px-3 py-3 flex items-center gap-3 ${allDone ? 'opacity-60' : ''}`}
                style={{ border: '1px solid rgba(212,160,23,0.15)', background: allDone ? 'rgba(34,197,94,0.06)' : undefined }}>
                <div className="text-sm w-5 text-center shrink-0">{allDone ? '✅' : (isSocial ? '🔗' : '🎯')}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{task.title}</p>
                  {task.description && <p className="text-[10px] text-muted-foreground">{task.description}</p>}
                  {!isSocial && !allDone && current !== null && (
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
                {allDone ? (
                  claimedBadge
                ) : isSocial ? (
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
                  lockedBadge
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Achievements list (progresivo: una por categoría) */}
      {tab === 'logros' && (
        <div className="px-4 space-y-2">
          {visibleAchievements.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No hay logros disponibles.</p>
          ) : visibleAchievements.map(({ item: ach, allDone }) => {
            const { current, target, isComplete } = getProgress(ach)
            return (
              <div key={ach.id} className={`bg-card rounded-xl px-3 py-3 flex items-center gap-3 ${allDone ? 'opacity-60' : ''}`}
                style={{ border: '1px solid rgba(212,160,23,0.15)', background: allDone ? 'rgba(34,197,94,0.06)' : undefined }}>
                <div className="text-sm w-5 text-center shrink-0">{allDone ? '✅' : '🏅'}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{ach.title}</p>
                  {ach.description && <p className="text-[10px] text-muted-foreground">{ach.description}</p>}
                  {!allDone && current !== null && (
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
                {allDone ? (
                  claimedBadge
                ) : isComplete ? (
                  <button onClick={() => claimAchievement(ach)} disabled={claiming === ach.id}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-black btn-gold disabled:opacity-50 shrink-0">
                    {claiming === ach.id ? '...' : 'Reclamar'}
                  </button>
                ) : (
                  lockedBadge
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
