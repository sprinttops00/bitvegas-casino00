import { motion } from 'framer-motion';

export default function WelcomeModal({ username, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="w-full max-w-xs rounded-3xl p-7 text-center"
        style={{ background: 'linear-gradient(135deg, #1a1200, #0d0900)', border: '2px solid rgba(212,160,23,0.5)', boxShadow: '0 0 60px rgba(212,160,23,0.2)' }}>
        <div className="text-5xl mb-3">🎰</div>
        <h1 className="text-2xl font-black text-white mb-1">¡Bienvenido!</h1>
        <p className="text-primary font-black text-lg mb-3">{username}</p>
        <div className="rounded-2xl py-4 px-5 mb-5" style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.35)' }}>
          <p className="text-xs text-white/60 uppercase tracking-widest mb-1">Bono de bienvenida</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl">💰</span>
            <span className="text-4xl font-black" style={{
              background: 'linear-gradient(180deg, #f6d365, #d4a017)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>+100</span>
            <span className="text-white/60 font-bold text-sm">TOKENS</span>
          </div>
          <p className="text-xs text-white/40 mt-1">Ya están en tu saldo</p>
        </div>
        <p className="text-xs text-white/50 mb-5 leading-relaxed">Juega, gana TOKENS y retíralos como criptomonedas. <span className="text-primary font-bold">10.000 TOKENS = 1 TON</span></p>
        <button onClick={onClose}
          className="w-full py-3.5 rounded-2xl font-black text-base tracking-wider active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #f6d365, #d4a017)', color: '#1a0e05' }}>
          ¡EMPEZAR A JUGAR! 🚀
        </button>
      </motion.div>
    </motion.div>
  );
}