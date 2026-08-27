import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB } from '@/lib/db'
import Avatar from '@/components/Avatar'

const GAMES = [
  { id: 'roulette', name: 'Ruleta', description: 'Apuesta a números, colores o docenas', emoji: '🎡', path: '/games/roulette', gradient: 'from-red-900/40 to-red-950/20', border: '#8B1414', tag: 'CLÁSICO' },
  { id: 'highlow', name: 'High / Low', description: 'Adivina si el número será mayor o menor', emoji: '🔢', path: '/games/highlow', gradient: 'from-cyan-900/40 to-cyan-950/20', border: '#0e5a6b', tag: 'RÁPIDO' },
  { id: 'dados', name: 'Dados', description: 'Lanza los dados y apuesta al resultado', emoji: '🎲', path: '/games/dados', gradient: 'from-amber-900/40 to-amber-950/20', border: '#6b4a0e', tag: 'NUEVO' },
  { id: 'crash', name: 'Crash', description: 'Cobra antes de que explote el multiplicador', emoji: '🚀', path: '/games/crash', gradient: 'from-purple-900/40 to-purple-950/20', border: '#4a0e6b', tag: 'HOT' },
  { id: 'tragamonedas', name: 'Tragamonedas', description: 'Gira y combina los símbolos', emoji: '🎰', path: '/games/tragamonedas', gradient: 'from-pink-900/40 to-pink-950/20', border: '#6b0e3a', tag: 'POPULAR' },
  { id: 'loteria', name: 'Lotería', description: 'Elige tus números y espera el sorteo', emoji: '🎱', path: '/games/loteria', gradient: 'from-green-900/40 to-green-950/20', border: '#0e6b1a', tag: 'SUERTE' },
];

export default function Games() {
  const [player, setPlayer] = useState(null)

  useEffect(() => { loadPlayer() }, [])

  const loadPlayer = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setPlayer(u)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #1a0e05 0%, #0d0704 100%)' }}>
      {/* Header estandarizado */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link to="/" className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <Avatar src={player?.photo_url} name={player?.username || player?.first_name} size={40} />
        <div className="flex-1">
          <h1 className="text-lg font-black text-foreground">{player?.username || player?.first_name || 'Jugador'}</h1>
          <p className="text-[10px] text-muted-foreground font-bold">{(player?.weekly_points || 0).toLocaleString()} PTS</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">TOKENS</div>
          <div className="text-base font-black text-primary">{(player?.tokens || 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <h1 className="text-3xl font-black tracking-wider" style={{
          background: 'linear-gradient(180deg, #f6d365 0%, #d4a017 50%, #9a6f00 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 2px 6px rgba(212,160,23,0.5))',
        }}>SALA DE JUEGOS</h1>
        <p className="text-sm text-muted-foreground mt-1">Elige tu juego y apuesta TOKENS</p>
      </div>

      <div className="px-4 grid grid-cols-2 gap-3">
        {GAMES.map(game => (
          <Link key={game.id} to={game.path} className="block">
            <div className={`bg-gradient-to-br ${game.gradient} rounded-2xl p-4 active:scale-95 transition-all duration-200 relative overflow-hidden`}
              style={{ border: `2px solid ${game.border}`, boxShadow: `0 4px 16px rgba(0,0,0,0.5)` }}>
              <div className="absolute top-2 right-2">
                <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full bg-black/40 text-primary border border-primary/30">
                  {game.tag}
                </span>
              </div>
              <div className="text-4xl mb-2">{game.emoji}</div>
              <h2 className="text-sm font-black text-white">{game.name}</h2>
              <p className="text-[10px] text-white/50 mt-0.5 leading-tight">{game.description}</p>
              <div className="flex items-center justify-end mt-2">
                <ChevronRight size={14} className="text-white/30" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="px-4 mt-5 mb-2">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(212,160,23,0.06)', border: '1px solid rgba(212,160,23,0.15)' }}>
          <h3 className="text-xs font-black text-primary mb-2 tracking-wider">💡 CÓMO GANAR TOKENS</h3>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-2"><span className="text-primary">•</span><span>Gana partidas y acumula TOKENS</span></div>
            <div className="flex items-start gap-2"><span className="text-primary">•</span><span>Completa tareas y logros para obtener bonos</span></div>
            <div className="flex items-start gap-2"><span className="text-primary">•</span><span>Canjea tus TOKENS por TON, USDT u otras criptos</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
