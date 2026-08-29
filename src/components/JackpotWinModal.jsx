import { motion, AnimatePresence } from 'framer-motion'

const RANK_INFO = {
  1: { medal: '🥇', label: '1er lugar' },
  2: { medal: '🥈', label: '2do lugar' },
  3: { medal: '🥉', label: '3er lugar' },
}

// Se muestra cuando el jugador quedó entre los 3 primeros del Ranking semanal
// y no estaba conectado en el momento exacto del reparto del domingo.
export default function JackpotWinModal({ rank, amount, onClose }) {
  const info = RANK_INFO[rank] || RANK_INFO[3]
  return (
    <AnimatePresence>
      {rank && amount > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.75)' }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-xs rounded-2xl p-6 text-center"
            style={{
              background: 'linear-gradient(180deg, #1a1200 0%, #0d0900 100%)',
              border: '2px solid rgba(212,160,23,0.5)',
              boxShadow: '0 0 40px rgba(212,160,23,0.4), 0 8px 32px rgba(0,0,0,0.7)',
            }}
          >
            <div className="text-6xl mb-2">{info.medal}</div>
            <h3 className="text-lg font-black text-white mb-1 tracking-wide">
              ¡Ganaste el Jackpot Semanal!
            </h3>
            <p className="text-xs text-white/70 leading-relaxed mb-4">
              Quedaste en <span className="text-primary font-bold">{info.label}</span> del Ranking de la semana pasada.
            </p>
            <div className="rounded-xl py-3 mb-5" style={{ background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.3)' }}>
              <p className="text-2xl font-black text-primary">+{amount.toLocaleString()} TOKENS</p>
              <p className="text-[10px] text-white/50 mt-0.5">Ya se sumaron a tu balance</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-black text-sm tracking-widest active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #f6d365, #d4a017)', color: '#1a0e05' }}
            >
              ¡GENIAL!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
