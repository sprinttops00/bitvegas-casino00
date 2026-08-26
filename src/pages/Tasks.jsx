import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, tasksDB, achievementsDB, referralDB, transactionDB } from '@/lib/db'
import { Zap, ArrowLeft, Lock, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import Avatar from '@/components/Avatar'

// Categorías de tareas y logros para cadenas progresivas
const TASK_CATEGORIES = ['social', 'referral', 'games_played', 'games_won']
const ACH_CATEGORIES = ['total_winnings', 'games_played', 'best_streak']

// Obtiene la tarea o logro activo (la primera pendiente de la cadena en cada categoría)
function getActiveItems(items, categories, completedIds) {
  const active = []
  const categorizedTypes = new Set(categories)

  // 1. Para las categorías en cadena: primera pendiente de cada categoría
  categories.forEach(cat => {
    const catItems = items
      .filter(it => it.type === cat)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    const firstPending = catItems.find(it => !completedIds.includes(it.id))
    if (firstPending) {
      active.push(firstPending)
    }
  })

  // 2. Para cualquier otra tarea/logro cuyo tipo no esté en la lista fija
  const otherItems = items
    .filter(it => !categorizedTypes.has(it.type) && !completedIds.includes(it.id))
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
  active.push(...otherItems)

  return active
}

// Obtiene todos los items que el usuario ya completó/reclamó
function getCompletedItems(items, completedIds) {
  return items
    .filter(it => completedIds.includes(it.id))
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
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
  // del jugador (leídas de la base de datos).
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

  const creditReward = async (rewardTokens, rewardPoints, sourceName = 'task_reward') => {
    const newTokens = (player.tokens || 0) + (rewardTokens || 0)
    const newPoints = (player.points || 0) + (rewardPoints || 0)
    const updated = await userDB.update(player.id, {
      tokens: newTokens,
      points: newPoints,
      weekly_points: (player.weekly_points || 0) + (rewardPoints || 0),
    })
    // Registra la transacción para trazabilidad y auditoría
    if (rewardTokens > 0) {
      try {
        await transactionDB.create({
          userId: player.id,
          amount: rewardTokens,
          type: 'credit',
          source: sourceName,
          balanceAfter: newTokens,
        })
      } catch (err) {
        console.warn('Error registrando transacción:', err)
      }
    }
    setPlayer(updated)
  }

  const claimTask = async (task) => {
    if (!player || claiming) return
    if (completedTaskIds.includes(task.id)) return
    // Las tareas automáticas solo se reclaman si el jugador cumple el requisito
    if (task.type !== 'social') {
      const { isComplete } = getProgress(task)
      if (!isComplete) return
    }
    setClaiming(task.id)
    try {
      await creditReward(task.token_reward, task.points_reward, `task_reward_${task.id}`)
      await tasksDB.complete({ userId: player.id, taskId: task.id })
      setCompletedTaskIds(prev => [...prev, task.id])
    } finally {
      setClaiming(null)
    }
  }

  // Tareas de redes sociales: abre el enlace y reclama
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
    try {
      await creditReward(ach.token_reward, ach.points_reward, `achievement_${ach.id}`)
      await achievementsDB.unlock({ userId: player.id, achievementId: ach.id })
      setCompletedAchievIds(prev => [...prev, ach.id])
    } finally {
      setClaiming(null)
    }
  }

  const totalItems = tasks.length + achievements.length
  const completedCount = completedTaskIds.length + completedAchievIds.length

  // Listas separadas para Activas y Completadas
  const activeTasks = getActiveItems(tasks, TASK_CATEGORIES, completedTaskIds)
  const completedTasks = getCompletedItems(tasks, completedTaskIds)

  const activeAchievements = getActiveItems(achievements, ACH_CATEGORIES, completedAchievIds)
  const completedAchievements = getCompletedItems(achievements, completedAchievIds)

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
      {/* Header */}
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

      {/* Barra de progreso global */}
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

      {/* ── PESTAÑA: TAREAS ─────────────────────────────────────────── */}
      {tab === 'tareas' && (
        <div className="px-4 space-y-4">
          {/* SECCIÓN ACTIVAS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-foreground/80 flex items-center gap-1.5 tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Activas ({activeTasks.length})
              </span>
            </div>

            {activeTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 italic">
                {completedTasks.length > 0 ? '¡Has completado todas las tareas disponibles!' : 'No hay tareas activas.'}
              </p>
            ) : (
              <div className="space-y-2">
                {activeTasks.map(task => {
                  const isSocial = task.type === 'social'
                  const { current, target, isComplete } = getProgress(task)
                  return (
                    <div key={task.id} className="bg-card rounded-xl px-3 py-3 flex items-center gap-3"
                      style={{ border: '1px solid rgba(212,160,23,0.2)' }}>
                      <div className="text-sm w-5 text-center shrink-0">{isSocial ? '🔗' : '🎯'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{task.title}</p>
                        {task.description && <p className="text-[10px] text-muted-foreground">{task.description}</p>}
                        {!isSocial && current !== null && (
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

                      {isSocial ? (
                        <button onClick={() => handleSocialTask(task)} disabled={claiming === task.id}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-black btn-gold disabled:opacity-50 shrink-0">
                          {claiming === task.id ? '...' : 'Ir y Reclamar'}
                        </button>
                      ) : isComplete ? (
                        <button onClick={() => claimTask(task)} disabled={claiming === task.id}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-black btn-gold disabled:opacity-50 shrink-0 shadow-lg shadow-yellow-500/20">
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
          </div>

          {/* SECCIÓN COMPLETADAS */}
          {completedTasks.length > 0 && (
            <div className="pt-2 border-t border-border/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 tracking-wider uppercase">
                  <CheckCircle2 size={13} className="text-green-400" />
                  Completadas ({completedTasks.length})
                </span>
              </div>

              <div className="space-y-2">
                {completedTasks.map(task => (
                  <div key={task.id} className="bg-card/60 rounded-xl px-3 py-2.5 flex items-center gap-3 opacity-75"
                    style={{ border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.04)' }}>
                    <div className="text-sm w-5 text-center shrink-0">✅</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground line-through opacity-75">{task.title}</p>
                      {task.description && <p className="text-[10px] text-muted-foreground">{task.description}</p>}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">+{task.token_reward} TKN</span>
                        {task.points_reward > 0 && <span className="text-[10px] text-muted-foreground">+{task.points_reward} PTS</span>}
                      </div>
                    </div>
                    {claimedBadge}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PESTAÑA: LOGROS ─────────────────────────────────────────── */}
      {tab === 'logros' && (
        <div className="px-4 space-y-4">
          {/* SECCIÓN ACTIVOS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-foreground/80 flex items-center gap-1.5 tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Activos ({activeAchievements.length})
              </span>
            </div>

            {activeAchievements.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 italic">
                {completedAchievements.length > 0 ? '¡Has desbloqueado todos los logros disponibles!' : 'No hay logros activos.'}
              </p>
            ) : (
              <div className="space-y-2">
                {activeAchievements.map(ach => {
                  const { current, target, isComplete } = getProgress(ach)
                  return (
                    <div key={ach.id} className="bg-card rounded-xl px-3 py-3 flex items-center gap-3"
                      style={{ border: '1px solid rgba(212,160,23,0.2)' }}>
                      <div className="text-sm w-5 text-center shrink-0">🏅</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{ach.title}</p>
                        {ach.description && <p className="text-[10px] text-muted-foreground">{ach.description}</p>}
                        {current !== null && (
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

                      {isComplete ? (
                        <button onClick={() => claimAchievement(ach)} disabled={claiming === ach.id}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-black btn-gold disabled:opacity-50 shrink-0 shadow-lg shadow-yellow-500/20">
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

          {/* SECCIÓN COMPLETADOS */}
          {completedAchievements.length > 0 && (
            <div className="pt-2 border-t border-border/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 tracking-wider uppercase">
                  <CheckCircle2 size={13} className="text-green-400" />
                  Completados ({completedAchievements.length})
                </span>
              </div>

              <div className="space-y-2">
                {completedAchievements.map(ach => (
                  <div key={ach.id} className="bg-card/60 rounded-xl px-3 py-2.5 flex items-center gap-3 opacity-75"
                    style={{ border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.04)' }}>
                    <div className="text-sm w-5 text-center shrink-0">✅</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground line-through opacity-75">{ach.title}</p>
                      {ach.description && <p className="text-[10px] text-muted-foreground">{ach.description}</p>}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">+{ach.token_reward} TKN</span>
                        {ach.points_reward > 0 && <span className="text-[10px] text-muted-foreground">+{ach.points_reward} PTS</span>}
                      </div>
                    </div>
                    {claimedBadge}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
