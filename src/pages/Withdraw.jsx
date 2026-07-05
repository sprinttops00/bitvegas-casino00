import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, withdrawalDB, transactionDB } from '@/lib/db'
import { processExpressWithdrawalAds } from '@/lib/finance'
import { showDoubleAd } from '@/lib/adsgram'
import { ArrowLeft, Clock, Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CONFIG } from '@/lib/config'

const TON_RATE = CONFIG.TON_TO_TOKENS // tokens por 1 TON

export default function Withdraw() {
  const [user, setUser] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])
  const [amount, setAmount] = useState(1000)
  const [wallet, setWallet] = useState('')
  const [mode, setMode] = useState(null) // null | 'standard' | 'express'
  const [step, setStep] = useState('form') // 'form' | 'watching_ads' | 'processing' | 'success' | 'queued'
  const [error, setError] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) {
      setUser(u)
      const w = await withdrawalDB.getByUserId(u.id, 10)
      setWithdrawals(w)
    }
  }

  const tonAmount = (amount / TON_RATE).toFixed(4)
  const canWithdraw = user && amount >= CONFIG.MIN_WITHDRAWAL_TOKENS && amount <= (user?.tokens || 0) && wallet.length > 5

  // ── RETIRO ESTÁNDAR (24-48h) ────────────────────────────
  const submitStandard = async () => {
    if (!canWithdraw) return
    setStep('processing')

    // Descontar tokens del balance
    await userDB.update(user.id, { tokens: user.tokens - amount })
    await transactionDB.create({
      userId: user.id,
      amount,
      type: 'debit',
      source: 'withdrawal_standard',
      balanceAfter: user.tokens - amount,
    })

    // Crear solicitud de retiro pendiente
    await withdrawalDB.create({
      userId: user.id,
      tokenAmount: amount,
      tonAmount: parseFloat(tonAmount),
      walletAddress: wallet,
      status: 'pending',
    })

    setStep('queued')
    loadData()
  }

  // ── RETIRO EXPRESS (ver 2 anuncios) ──────────────────────
  const submitExpress = async () => {
    if (!canWithdraw) return
    setStep('watching_ads')

    showDoubleAd({
      onComplete: async () => {
        setStep('processing')

        // Procesar comisión de anuncios al dev
        await processExpressWithdrawalAds({ userId: user.id })

        // Descontar tokens
        await userDB.update(user.id, { tokens: user.tokens - amount })
        await transactionDB.create({
          userId: user.id,
          amount,
          type: 'debit',
          source: 'withdrawal_express',
          balanceAfter: user.tokens - amount,
        })

        // Crear solicitud marcada como completada (pago inmediato)
        await withdrawalDB.create({
          userId: user.id,
          tokenAmount: amount,
          tonAmount: parseFloat(tonAmount),
          walletAddress: wallet,
          status: 'completed', // El bot la procesará con prioridad
        })

        setStep('success')
        loadData()
      },
      onFail: (reason) => {
        setError('Necesitas ver los 2 anuncios completos para el retiro express.')
        setStep('form')
        setMode(null)
      },
    })
  }

  // ── RENDER ───────────────────────────────────────────────

  if (step === 'watching_ads') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4 text-center">
        <div className="text-5xl animate-bounce">📺</div>
        <h2 className="text-xl font-black text-foreground">Viendo anuncios...</h2>
        <p className="text-sm text-muted-foreground">Mira los 2 anuncios completos para desbloquear tu retiro express.</p>
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-2" />
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4 text-center">
        <Loader2 size={48} className="text-primary animate-spin" />
        <h2 className="text-xl font-black text-foreground">Procesando retiro...</h2>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5">
        <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-4xl">⚡</div>
        <h2 className="text-2xl font-black text-foreground">¡Retiro Express!</h2>
        <p className="text-sm text-muted-foreground">Tu pago de <span className="text-primary font-bold">{tonAmount} TON</span> está siendo procesado de inmediato.</p>
        <p className="text-xs text-muted-foreground">Wallet: <span className="text-foreground font-mono">{wallet.slice(0, 8)}...{wallet.slice(-6)}</span></p>
        <Link to="/" className="btn-gold px-8 py-3 rounded-2xl font-black text-sm">Volver al Lobby</Link>
      </div>
    )
  }

  if (step === 'queued') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5">
        <div className="w-20 h-20 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-4xl">⏳</div>
        <h2 className="text-2xl font-black text-foreground">¡Solicitud Enviada!</h2>
        <div className="bg-card rounded-2xl p-4 text-left space-y-2 w-full" style={{ border: '1px solid rgba(212,160,23,0.2)' }}>
          <p className="text-xs text-muted-foreground">El sistema está procesando varios pagos. Tu retiro se completará en:</p>
          <p className="text-xl font-black text-primary">24 – 48 horas</p>
          <div className="h-px bg-border my-2" />
          <p className="text-xs text-muted-foreground">¿No quieres esperar? Vuelve atrás y elige <span className="text-primary font-bold">Retiro Express</span> viendo un par de anuncios 🚀</p>
        </div>
        <Link to="/" className="btn-gold px-8 py-3 rounded-2xl font-black text-sm">Volver al Lobby</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link to="/" className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-black text-foreground">Retirar TON</h1>
      </div>

      {/* Balance */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl p-4 text-center" style={{
          background: 'linear-gradient(135deg, #1a1200, #0d0900)',
          border: '2px solid rgba(212,160,23,0.3)',
        }}>
          <p className="text-xs text-muted-foreground font-bold tracking-widest mb-1">TU SALDO</p>
          <p className="text-3xl font-black" style={{
            background: 'linear-gradient(180deg, #f6d365, #d4a017)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>{(user?.tokens || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">TOKENS · Mín. retiro: {CONFIG.MIN_WITHDRAWAL_TOKENS.toLocaleString()}</p>
        </div>
      </div>

      {/* Form */}
      {!mode && (
        <div className="px-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Cantidad (TOKENS)</label>
            <input
              type="number"
              min={CONFIG.MIN_WITHDRAWAL_TOKENS}
              max={user?.tokens || 0}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary/50"
            />
            <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
              <span>≈ {tonAmount} TON</span>
              <button onClick={() => setAmount(user?.tokens || 0)} className="text-primary font-bold">MAX</button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tu Wallet TON</label>
            <input
              type="text"
              placeholder="UQ..."
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-primary/50 font-mono placeholder:text-muted-foreground"
            />
          </div>

          {/* Selector de modo */}
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest text-center pt-2">Elige cómo retirar</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { if (canWithdraw) setMode('standard') }}
              disabled={!canWithdraw}
              className="rounded-2xl p-4 text-center border transition-all active:scale-95 disabled:opacity-40 flex flex-col items-center gap-2"
              style={{ background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.3)' }}
            >
              <Clock size={24} className="text-primary" />
              <p className="text-sm font-black text-foreground">Estándar</p>
              <p className="text-[10px] text-muted-foreground">24 – 48 horas</p>
              <p className="text-[10px] text-green-400">Gratis</p>
            </button>

            <button
              onClick={() => { if (canWithdraw) setMode('express') }}
              disabled={!canWithdraw}
              className="rounded-2xl p-4 text-center border transition-all active:scale-95 disabled:opacity-40 flex flex-col items-center gap-2"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <Zap size={24} className="text-green-400" />
              <p className="text-sm font-black text-foreground">Express</p>
              <p className="text-[10px] text-muted-foreground">Inmediato</p>
              <p className="text-[10px] text-accent">Ver 2 anuncios</p>
            </button>
          </div>
        </div>
      )}

      {/* Confirmación estándar */}
      {mode === 'standard' && (
        <div className="px-4 space-y-4">
          <div className="bg-card rounded-2xl p-4 space-y-3" style={{ border: '1px solid rgba(212,160,23,0.2)' }}>
            <h3 className="font-black text-foreground flex items-center gap-2"><Clock size={16} className="text-primary" /> Retiro Estándar</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tokens:</span><span className="font-bold text-foreground">{amount.toLocaleString()} TKN</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recibirás:</span><span className="font-bold text-primary">{tonAmount} TON</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Wallet:</span><span className="font-mono text-[11px] text-foreground">{wallet.slice(0,8)}...{wallet.slice(-4)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tiempo:</span><span className="text-yellow-400 font-bold">24 – 48 horas</span></div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-400/80">
              ⏳ El sistema procesa los pagos en lotes. Tu TON llegará en 24-48h. ¿Tienes prisa? Vuelve y elige Express.
            </div>
          </div>
          <button onClick={submitStandard} className="w-full py-4 rounded-2xl btn-gold text-sm font-black active:scale-95 transition-all">
            Confirmar Retiro Estándar
          </button>
          <button onClick={() => setMode(null)} className="w-full py-3 rounded-2xl text-sm font-bold text-muted-foreground bg-secondary border border-border">
            Cancelar
          </button>
        </div>
      )}

      {/* Confirmación express */}
      {mode === 'express' && (
        <div className="px-4 space-y-4">
          <div className="bg-card rounded-2xl p-4 space-y-3" style={{ border: '1px solid rgba(34,197,94,0.2)' }}>
            <h3 className="font-black text-foreground flex items-center gap-2"><Zap size={16} className="text-green-400" /> Retiro Express</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tokens:</span><span className="font-bold text-foreground">{amount.toLocaleString()} TKN</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recibirás:</span><span className="font-bold text-primary">{tonAmount} TON</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Wallet:</span><span className="font-mono text-[11px] text-foreground">{wallet.slice(0,8)}...{wallet.slice(-4)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tiempo:</span><span className="text-green-400 font-bold">Inmediato ⚡</span></div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-xs text-green-400/80">
              📺 Solo tienes que ver 2 anuncios cortos y tu TON se enviará inmediatamente a tu wallet.
            </div>
          </div>
          <button onClick={submitExpress} className="w-full py-4 rounded-2xl text-sm font-black active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)', color: 'white' }}>
            📺 Ver 2 Anuncios y Retirar Ahora
          </button>
          <button onClick={() => setMode(null)} className="w-full py-3 rounded-2xl text-sm font-bold text-muted-foreground bg-secondary border border-border">
            Cancelar
          </button>
        </div>
      )}

      {/* Historial */}
      {withdrawals.length > 0 && step === 'form' && !mode && (
        <div className="px-4 mt-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Historial de Retiros</h2>
          <div className="space-y-2">
            {withdrawals.map(w => (
              <div key={w.id} className="bg-card rounded-xl px-3 py-3 flex items-center gap-3" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
                {w.status === 'completed'
                  ? <CheckCircle size={14} className="text-green-400 shrink-0" />
                  : w.status === 'failed'
                  ? <AlertCircle size={14} className="text-red-400 shrink-0" />
                  : <Clock size={14} className="text-yellow-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{w.token_amount?.toLocaleString()} TKN → {w.ton_amount} TON</p>
                  <p className="text-[10px] text-muted-foreground truncate">{w.wallet_address?.slice(0,12)}...</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  w.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  w.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>{w.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}