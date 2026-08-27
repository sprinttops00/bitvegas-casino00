import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB } from '@/lib/db'
import { showAd } from '@/lib/adsgram'
import { processAdReward } from '@/lib/finance'
import { CONFIG } from '@/lib/config'
import { ChevronRight, Bell } from 'lucide-react'
import WelcomeModal from '@/components/WelcomeModal'
import Avatar from '@/components/Avatar'

export default function Lobby() {
  const [player, setPlayer] = useState(null)
  const [dailyClaimed, setDailyClaimed] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [watchingAd, setWatchingAd] = useState(false)
  const [adMessage, setAdMessage] = useState(null)

  // Recargamos los datos del jugador siempre que el Lobby vuelve a estar
  // activo. Así las estadísticas (Jugadas / Victorias / Mejor racha) y el
  // balance se muestran actualizados tras jugar cualquier partida.
  const location = useLocation()
  useEffect(() => { loadPlayer() }, [location.key])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    let u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) {
      setPlayer(u)
      const todayStr = new Date().toISOString().split('T')[0]
      const lastClaim = u.last_daily_claim?.split('T')[0]
      setDailyClaimed(lastClaim === todayStr)
    } else {
      const newUser = await userDB.create(tgUser)
      setPlayer(newUser)
      setShowWelcome(true)
    }
  }

  const totalGames = (player?.user_statistics?.total_games_played || 0)
  const totalWins = (player?.user_statistics?.total_wins || 0)
  const bestStreak = (player?.user_statistics?.best_streak || 0)

  // ── Ver anuncio y ganar tokens ────────────────────────────
  const watchAd = () => {
    if (!player || watchingAd) return
    setWatchingAd(true)
    setAdMessage(null)

    showAd({
      onReward: async () => {
        const { newBalance } = await processAdReward({
          userId: player.id,
          currentBalance: player.tokens,
        })
        setPlayer(prev => ({ ...prev, tokens: newBalance }))
        setAdMessage(`¡Ganaste ${CONFIG.TOKENS_PER_AD} TOKENS! 🎉`)
        setWatchingAd(false)
      },
      onSkip: () => {
        setAdMessage('Debes ver el anuncio completo para ganar tokens.')
        setWatchingAd(false)
      },
      onError: () => {
        setAdMessage('No hay anuncios disponibles en este momento.')
        setWatchingAd(false)
      },
    })
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0d0a00 0%, #0d0704 100%)' }}>
      {showWelcome && <WelcomeModal username={player?.username} onClose={() => setShowWelcome(false)} />}

      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Link to="/profile">
          <Avatar src={player?.photo_url} name={player?.username || player?.first_name} size={56} />
        </Link>
        <div>
          <p className="text-sm text-muted-foreground">¡HOLA!, <span className="text-primary font-black">{player?.username || player?.first_name || '...'}</span></p>
          <p className="text-xs text-muted-foreground">¿Listo para ganar?</p>
        </div>
      </div>

      <div className="px-4 mb-4">
        <Link to="/daily-reward">
          <div className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-95"
            style={{
              background: dailyClaimed ? 'rgba(34,197,94,0.1)' : 'rgba(212,160,23,0.12)',
              border: `1px solid ${dailyClaimed ? 'rgba(34,197,94,0.3)' : 'rgba(212,160,23,0.4)'}`,
            }}>
            <div className="flex items-center gap-2">
              <Bell size={14} className={dailyClaimed ? 'text-green-400' : 'text-primary'} />
              <span className="text-xs font-black tracking-wider" style={{ color: dailyClaimed ? '#22c55e' : '#f6d365' }}>
                {dailyClaimed ? '✅ RECOMPENSA RECLAMADA' : '¡RECOMPENSA DIARIA DISPONIBLE!'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-primary font-black text-sm">VER <ChevronRight size={16} /></div>
          </div>
        </Link>
      </div>

      <div className="px-4 mb-4">
        <div className="rounded-2xl p-5" style={{
          background: 'linear-gradient(135deg, #1a1200 0%, #0d0900 100%)',
          border: '2px solid rgba(212,160,23,0.3)',
          boxShadow: '0 0 0 1px rgba(212,160,23,0.1), 0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <h2 className="text-xs font-black text-white tracking-widest text-center mb-3">BALANCE TOTAL</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-3xl">💰</span>
              <span className="text-4xl font-black" style={{
                background: 'linear-gradient(180deg, #f6d365, #d4a017)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>{(player?.tokens || 0).toLocaleString()}</span>
              <span className="text-sm text-white/60 font-bold">TOKENS</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/40 font-bold">PUNTOS</p>
              <p className="text-2xl font-black text-white">{(player?.weekly_points || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'JUGADAS', value: totalGames, icon: '⚡' },
            { label: 'VICTORIAS', value: totalWins, icon: '🏆' },
            { label: 'MEJOR RACHA', value: bestStreak, icon: '📈' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-2xl p-3 text-center" style={{
              background: 'linear-gradient(135deg, #1a1200, #0d0900)',
              border: '1px solid rgba(212,160,23,0.2)',
            }}>
              <div className="text-xl mb-1">{icon}</div>
              <p className="text-2xl font-black" style={{ color: '#d4a017' }}>{value}</p>
              <p className="text-[9px] text-white/50 font-black tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 mb-2">
        <h2 className="text-xs font-black text-white/50 tracking-widest text-center mb-3">ACCESO RÁPIDO</h2>
        <div className="space-y-2">
          <Link to="/games">
            <div className="flex items-center gap-4 px-4 py-4 rounded-2xl active:scale-95 transition-all" style={{
              background: 'linear-gradient(135deg, #1a1200, #0d0900)',
              border: '1px solid rgba(212,160,23,0.25)',
            }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                style={{ background: 'rgba(139,86,20,0.3)', border: '1px solid rgba(139,86,20,0.5)' }}>🎰</div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white">SALA DE JUEGOS</h3>
                <p className="text-[11px] text-white/40 mt-0.5">Ruleta | High/Low | Crash</p>
                <p className="text-[11px] text-white/40">| Dados | Tragamonedas | Lotería</p>
              </div>
              <ChevronRight size={20} className="text-white/30 shrink-0" />
            </div>
          </Link>
          <button onClick={watchAd} disabled={watchingAd} className="w-full text-left mt-2">
            <div className="flex items-center gap-4 px-4 py-4 rounded-2xl active:scale-95 transition-all disabled:opacity-60" style={{
              background: 'linear-gradient(135deg, #1a1200, #0d0900)',
              border: '1px solid rgba(212,160,23,0.25)',
            }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                style={{ background: 'rgba(30,80,60,0.4)', border: '1px solid rgba(30,120,60,0.4)' }}>📺</div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white">{watchingAd ? 'CARGANDO ANUNCIO...' : 'VER ANUNCIOS'}</h3>
                {adMessage ? (
                  <p className={`text-[11px] mt-0.5 font-bold ${adMessage.includes('Ganaste') ? 'text-green-400' : 'text-yellow-400'}`}>{adMessage}</p>
                ) : (
                  <p className="text-[11px] text-white/40 mt-0.5">Gana TOKENS mirando anuncios</p>
                )}
              </div>
              <ChevronRight size={20} className="text-white/30 shrink-0" />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
