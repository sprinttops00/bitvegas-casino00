import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const AUTO_DISMISS_MS = 3500

function ToastItem({ notification, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notification.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification.id])

  return (
    <motion.div
      layout
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      <Link
        to="/store"
        onClick={() => onDismiss(notification.id)}
        className="flex items-center gap-3 rounded-2xl px-3.5 py-3 active:scale-95 transition-all"
        style={{
          background: 'linear-gradient(135deg, #1a1200, #0d0900)',
          border: '2px solid rgba(212,160,23,0.5)',
          boxShadow: '0 0 20px rgba(212,160,23,0.25), 0 8px 24px rgba(0,0,0,0.6)',
        }}
      >
        <span className="text-2xl shrink-0">{notification.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white truncate">{notification.title}</p>
          <p className="text-[10px] text-white/60 truncate">{notification.message}</p>
        </div>
        <span className="text-[9px] font-black text-primary shrink-0 whitespace-nowrap">TIENDA →</span>
      </Link>
    </motion.div>
  )
}

// Muestra TODOS los avisos de potenciadores pendientes, uno debajo del otro
// (no uno a la vez). Cada uno se autodestruye solo tras unos segundos, y tocarlo
// lleva a la Tienda. El juego puede vaciar `notifications` de golpe (por ejemplo,
// al presionar "jugar" de nuevo) para que desaparezcan todos al instante.
export default function BoostAlert({ notifications, onDismiss }) {
  const list = notifications || []
  return (
    <div className="fixed left-4 right-4 z-[100] flex flex-col gap-2" style={{ top: '6.5rem' }}>
      <AnimatePresence>
        {list.map(n => (
          <ToastItem key={n.id} notification={n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}
