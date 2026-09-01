import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const AUTO_DISMISS_MS = 3500

// Notificación flotante que avisa cuándo se activó un potenciador del inventario.
// Se autodestruye sola después de unos segundos (igual que el aviso de compra
// exitosa de la Tienda) para no interrumpir el ritmo del juego con un cartel
// que el jugador tenga que cerrar a mano. Sigue siendo tocable: si el jugador
// la toca, lo lleva directo a la Tienda por si quiere comprar otro potenciador.
export default function BoostAlert({ notification, onClose }) {
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(onClose, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [notification, onClose])

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed left-4 right-4 z-[100]"
          style={{ top: '6.5rem' }}
        >
          <Link
            to="/store"
            onClick={onClose}
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
      )}
    </AnimatePresence>
  )
}
