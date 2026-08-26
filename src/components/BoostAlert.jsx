import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

// Modal flotante que avisa cuándo se activó un potenciador del inventario.
// Se usa en los 6 juegos de casino de forma idéntica.
export default function BoostAlert({ notification, onClose }) {
  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.72)' }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-xs rounded-2xl p-5 text-center"
            style={{
              background: 'linear-gradient(180deg, #1a1200 0%, #0d0900 100%)',
              border: '2px solid rgba(212,160,23,0.5)',
              boxShadow: '0 0 30px rgba(212,160,23,0.3), 0 8px 32px rgba(0,0,0,0.7)',
            }}
          >
            <div className="text-5xl mb-2">{notification.emoji}</div>
            <h3 className="text-base font-black text-white mb-1.5 tracking-wide">
              {notification.title}
            </h3>
            <p className="text-xs text-white/70 leading-relaxed mb-5">
              {notification.message}
            </p>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-black text-sm tracking-widest active:scale-95 transition-all mb-2"
              style={{ background: 'linear-gradient(135deg, #f6d365, #d4a017)', color: '#1a0e05' }}
            >
              ACEPTAR
            </button>

            <Link to="/store" onClick={onClose}>
              <button
                className="w-full py-2.5 rounded-xl font-bold text-xs tracking-wide active:scale-95 transition-all"
                style={{ background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.3)', color: '#f6d365' }}
              >
                🛒 Ver más potenciadores en la Tienda
              </button>
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
