import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '@/components/Avatar';

// Header uniforme para las pantallas de juego: mismo patrón que el resto de
// la app (flecha atrás + Avatar + Nombre + Puntos + Tokens), más el botón
// de información con las reglas de cada juego debajo del título.
export default function GameHeader({ player, title, infoTitle, infoContent }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <div className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/games" className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <Avatar src={player?.photo_url} name={player?.username || player?.first_name} size={40} />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-black text-foreground truncate">{player?.username || player?.first_name || 'Jugador'}</h2>
            <p className="text-[10px] text-muted-foreground font-bold">{(player?.weekly_points || 0).toLocaleString()} PTS</p>
          </div>
          <div className="text-right mr-1 shrink-0">
            <div className="text-[10px] text-muted-foreground">TOKENS</div>
            <div className="text-base font-black text-primary">{(player?.tokens || 0).toLocaleString()}</div>
          </div>
          <button onClick={() => setShowInfo(true)}
            className="w-9 h-9 rounded-xl border border-primary/30 flex items-center justify-center shrink-0"
            style={{ background: 'rgba(212,160,23,0.12)' }}>
            <Info size={16} className="text-primary" />
          </button>
        </div>
        <h1 className="text-2xl font-black tracking-widest text-center" style={{
          background: 'linear-gradient(180deg, #f6d365 0%, #d4a017 50%, #9a6f00 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 2px 6px rgba(212,160,23,0.5))',
        }}>{title}</h1>
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
                <h2 className="text-lg font-black text-primary">📖 {infoTitle}</h2>
                <button onClick={() => setShowInfo(false)} className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                {infoContent.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
