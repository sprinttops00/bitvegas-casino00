import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, withdrawalDB, transactionDB } from '@/lib/db'
import { processExpressWithdrawalAds } from '@/lib/finance'
import { showDoubleAd } from '@/lib/adsgram'
import { ArrowLeft, Clock, Zap, CheckCircle2, AlertCircle, Loader2, Wallet, Info, Plus, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CONFIG } from '@/lib/config'
import Avatar from '@/components/Avatar'

const GRAM_RATE = CONFIG.GRAM_TO_TOKENS || 10000 // 10,000 tokens = 1 GRAM
const MIN_TOKENS = CONFIG.MIN_WITHDRAWAL_TOKENS || 50000 // 50,000 tokens = 5 GRAM
const MIN_GRAM = MIN_TOKENS / GRAM_RATE // 5 GRAM

export default function Withdraw() {
  const [player, setPlayer] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])
  const [amount, setAmount] = useState(MIN_TOKENS)
  const [wallet, setWallet] = useState('')
  const [mode, setMode] = useState(null) // null | 'standard' | 'express'
  const [step, setStep] = useState('form') // 'form' | 'watching_ads' | 'processing' | 'success' | 'queued'
  const [error, setError] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) {
      setPlayer(u)
      const w = await withdrawalDB.getByUserId(u.id, 10)
      setWithdrawals(w)
      // Si ya tiene retiros previos, pre-llenar con su última wallet usada
      if (w.length > 0 && w[0].wallet_address) {
        setWallet(w[0].wallet_address)
      }
    }
  }

  const userBalance = player?.tokens || 0
  const gramAmount = (amount > 0 ? (amount / GRAM_RATE).toFixed(2) : '0.00')

  // Ajustadores de cantidad táctiles
  const handleAddAmount = (delta) => {
    setError(null)
    setAmount(prev => Math.max(0, (Number(prev) || 0) + delta))
  }

  const handleMaxAmount = () => {
    setError(null)
    setAmount(userBalance)
  }

  // Validación inteligente al hacer clic en los botones de retiro
  const validateAndProceed = (selectedMode) => {
    setError(null)

    if (!wallet.trim() || wallet.trim().length < 8) {
      setError('⚠️ Por favor ingresa una dirección de Wallet GRAM válida antes de continuar.')
      return
    }

    if (!amount || amount < MIN_TOKENS) {
      setError(`⚠️ El monto mínimo para retirar es de ${MIN_TOKENS.toLocaleString()} Tokens (${MIN_GRAM} GRAM).`)
      return
    }

    if (amount > userBalance) {
      setError(`⚠️ Saldo insuficiente. Tienes ${userBalance.toLocaleString()} Tokens disponibles e intentas retirar ${amount.toLocaleString()} Tokens.`)
      return
    }

    setMode(selectedMode)
  }

  // ── RETIRO ESTÁNDAR (24-48h) ────────────────────────────
  const submitStandard = async () => {
    setError(null)
    setStep('processing')

    try {
      const newBalance = userBalance - amount

      // 1. Descontar tokens del balance del jugador
      const updated = await userDB.update(player.id, { tokens: newBalance })

      // 2. Registrar transacción
      await transactionDB.create({
        userId: player.id,
        amount,
        type: 'debit',
        source: 'withdrawal_standard',
        balanceAfter: newBalance,
      })

      // 3. Crear solicitud de retiro pendiente en Supabase
      await withdrawalDB.create({
        userId: player.id,
        tokenAmount: amount,
        tonAmount: parseFloat(gramAmount),
        walletAddress: wallet.trim(),
        status: 'pending',
      })

      setPlayer(updated)
      setStep('queued')
      const w = await withdrawalDB.getByUserId(player.id, 10)
      setWithdrawals(w)
    } catch (err) {
      console.error('Error procesando retiro estándar:', err)
      setError('Ocurrió un error al procesar la solicitud. Intenta nuevamente.')
      setStep('form')
      setMode(null)
    }
  }

  // ── RETIRO EXPRESS (ver 2 anuncios → Inmediato) ─────────
  const submitExpress = async () => {
    setError(null)
    setStep('watching_ads')

    showDoubleAd({
      onComplete: async () => {
        setStep('processing')

        try {
          try {
            await processExpressWithdrawalAds({ userId: player.id })
          } catch (_) {}

          const newBalance = userBalance - amount

          // 1. Descontar tokens
          const updated = await userDB.update(player.id, { tokens: newBalance })

          // 2. Registrar transacción
          await transactionDB.create({
            userId: player.id,
            amount,
            type: 'debit',
            source: 'withdrawal_express',
            balanceAfter: newBalance,
          })

          // 3. Crear solicitud marcada como express
          await withdrawalDB.create({
            userId: player.id,
            tokenAmount: amount,
            tonAmount: parseFloat(gramAmount),
            walletAddress: wallet.trim(),
            status: 'completed',
          })

          setPlayer(updated)
          setStep('success')
          const w = await withdrawalDB.getByUserId(player.id, 10)
          setWithdrawals(w)
        } catch (err) {
          console.error('Error procesando retiro express:', err)
          setError('Error al procesar el retiro express.')
          setStep('form')
          setMode(null)
        }
      },
      onFail: (reason) => {
        setError('Debes ver los 2 anuncios completos para habilitar el retiro express.')
        setStep('form')
        setMode(null)
      },
    })
  }

  // ── PANTALLAS DE ESTADO ───────────────────────────────────────────

  if (step === 'watching_ads') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4 text-center pb-20">
        <div className="text-5xl animate-bounce">📺</div>
        <h2 className="text-xl font-black text-foreground">Viendo anuncios express...</h2>
        <p className="text-xs text-muted-foreground max-w-xs">
          Mira los 2 anuncios completos para activar la prioridad inmediata de tu retiro en GRAM.
        </p>
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-3" />
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4 text-center pb-20">
        <Loader2 size={44} className="text-primary animate-spin" />
        <h2 className="text-lg font-black text-foreground">Procesando solicitud de retiro...</h2>
        <p className="text-xs text-muted-foreground">Guardando los datos de tu wallet y actualizando balance.</p>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4 pb-20">
        <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-3xl">
          ⚡
        </div>
        <h2 className="text-xl font-black text-foreground">¡Retiro Express Aprobado!</h2>
        <div className="bg-card rounded-2xl p-4 text-left space-y-2.5 w-full border border-green-500/30">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Cantidad enviada:</span>
            <span className="font-black text-primary text-sm">{gramAmount} GRAM</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Tokens descontados:</span>
            <span className="font-bold text-foreground">{amount.toLocaleString()} TKN</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Wallet destino:</span>
            <span className="font-mono text-foreground">{wallet.slice(0, 8)}...{wallet.slice(-6)}</span>
          </div>
          <div className="h-px bg-border my-1" />
          <p className="text-[11px] text-green-400 font-bold text-center">
            🚀 Tu pago ha sido priorizado y se enviará en los próximos minutos.
          </p>
        </div>
        <Link to="/" className="btn-gold w-full py-3.5 rounded-xl font-black text-xs text-center shadow-lg">
          Volver al Inicio
        </Link>
      </div>
    )
  }

  if (step === 'queued') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4 pb-20">
        <div className="w-16 h-16 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-3xl">
          ⏳
        </div>
        <h2 className="text-xl font-black text-foreground">¡Solicitud en Cola!</h2>
        <div className="bg-card rounded-2xl p-4 text-left space-y-2.5 w-full border border-primary/20">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Recibirás:</span>
            <span className="font-black text-primary text-sm">{gramAmount} GRAM</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Tokens descontados:</span>
            <span className="font-bold text-foreground">{amount.toLocaleString()} TKN</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Wallet destino:</span>
            <span className="font-mono text-foreground">{wallet.slice(0, 8)}...{wallet.slice(-6)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Tiempo estimado:</span>
            <span className="font-bold text-yellow-400">24 – 48 horas</span>
          </div>
          <div className="h-px bg-border my-1" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Las solicitudes estándar se procesan por orden de llegada para verificar la seguridad de las partidas.
          </p>
        </div>
        <Link to="/" className="btn-gold w-full py-3.5 rounded-xl font-black text-xs text-center shadow-lg">
          Volver al Inicio
        </Link>
      </div>
    )
  }

  // ── FORMULARIO PRINCIPAL ──────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24">
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
          <div className="text-base font-black text-primary">{(userBalance).toLocaleString()}</div>
        </div>
      </div>

       <div className="px-4 pb-2">
        <h2 className="text-2xl font-black text-foreground">Retirar</h2>
      </div>

      {/* Tarjeta de Saldo y Tasa */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl p-4 text-center" style={{
          background: 'linear-gradient(135deg, #1a1200, #0d0900)',
          border: '2px solid rgba(212,160,23,0.3)',
        }}>
          <p className="text-[10px] text-muted-foreground font-black tracking-widest uppercase mb-1">Tu Balance Disponible</p>
          <p className="text-3xl font-black" style={{
            background: 'linear-gradient(180deg, #f6d365, #d4a017)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {userBalance.toLocaleString()} <span className="text-lg font-bold text-primary">TKN</span>
          </p>
          <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span>Tasa: <b className="text-foreground">10,000 TKN = 1 GRAM</b></span>
            <span>·</span>
            <span>Mínimo: <b className="text-primary">{MIN_GRAM} GRAM ({MIN_TOKENS.toLocaleString()} TKN)</b></span>
          </div>
        </div>
      </div>

      {/* Formulario */}
      {!mode && (
        <div className="px-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          {userBalance < MIN_TOKENS && !error && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-start gap-2.5">
              <Info size={16} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-yellow-300/90 leading-relaxed">
                El mínimo de retiro es de <b>{MIN_TOKENS.toLocaleString()} Tokens ({MIN_GRAM} GRAM)</b>. Tu saldo actual es de <b>{userBalance.toLocaleString()} Tokens</b>.
              </p>
            </div>
          )}

          {/* Input de cantidad de tokens */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Cantidad a retirar (TOKENS)
              </label>
              {/* Botones de incremento rápido y MAX */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAddAmount(-10000)}
                  className="text-[10px] text-muted-foreground font-bold px-2 py-0.5 rounded bg-secondary border border-border hover:text-foreground active:scale-95 transition-all"
                >
                  -10K
                </button>
                <button
                  onClick={() => handleAddAmount(10000)}
                  className="text-[10px] text-muted-foreground font-bold px-2 py-0.5 rounded bg-secondary border border-border hover:text-foreground active:scale-95 transition-all"
                >
                  +10K
                </button>
                <button
                  onClick={handleMaxAmount}
                  className="text-[10px] text-primary font-black px-2 py-0.5 rounded bg-primary/10 border border-primary/20 hover:bg-primary/20 active:scale-95 transition-all"
                >
                  MÁXIMO
                </button>
              </div>
            </div>

            {/* Input limpio sin flechas nativas estorbosas */}
            <div className="relative flex items-center">
              <input
                type="number"
                value={amount || ''}
                onChange={e => {
                  setError(null)
                  setAmount(Number(e.target.value))
                }}
                placeholder={MIN_TOKENS.toString()}
                className="w-full bg-secondary/80 border border-border rounded-xl px-4 py-3 text-foreground text-sm font-bold focus:outline-none focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3.5 text-xs font-black text-muted-foreground pointer-events-none">
                TKN
              </span>
            </div>

            <div className="flex justify-between mt-1 text-[11px]">
              <span className="text-muted-foreground">Recibirás en GRAM:</span>
              <span className="text-primary font-black text-xs">≈ {gramAmount} GRAM</span>
            </div>
          </div>

          {/* Input de Wallet */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Tu Wallet GRAM (Telegram / TON Wallet)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Pega aquí tu dirección (ej: UQ... o EQ...)"
                value={wallet}
                onChange={e => {
                  setError(null)
                  setWallet(e.target.value)
                }}
                className="w-full bg-secondary/80 border border-border rounded-xl px-4 py-3 text-foreground text-xs focus:outline-none focus:border-primary/50 font-mono placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-[10px] text-muted-foreground/80 mt-1">
              Dirección de tu billetera personal en la red TON (recibe tokens GRAM).
            </p>
          </div>

          {/* Opciones de Retiro */}
          <div className="pt-2">
            <p className="text-xs font-black text-foreground uppercase tracking-wider mb-2.5 text-center">
              Selecciona Método de Retiro
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Opción Estándar */}
              <button
                onClick={() => validateAndProceed('standard')}
                className="rounded-2xl p-3.5 text-center border transition-all active:scale-95 hover:border-primary/50 flex flex-col items-center gap-1.5"
                style={{ background: 'rgba(212,160,23,0.06)', border: '1px solid rgba(212,160,23,0.3)' }}
              >
                <Clock size={22} className="text-primary" />
                <p className="text-xs font-black text-foreground">Estándar</p>
                <p className="text-[10px] text-muted-foreground">24 – 48 horas</p>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  GRATIS
                </span>
              </button>

              {/* Opción Express */}
              <button
                onClick={() => validateAndProceed('express')}
                className="rounded-2xl p-3.5 text-center border transition-all active:scale-95 hover:border-green-500/60 flex flex-col items-center gap-1.5 relative overflow-hidden"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.4)' }}
              >
                <div className="absolute top-1 right-2 text-[8px] font-black text-green-400 animate-pulse">FAST</div>
                <Zap size={22} className="text-green-400" />
                <p className="text-xs font-black text-foreground">Express</p>
                <p className="text-[10px] text-muted-foreground">Inmediato ⚡</p>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30">
                  VER 2 ANUNCIOS
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación: Retiro Estándar */}
      {mode === 'standard' && (
        <div className="px-4 space-y-4">
          <div className="bg-card rounded-2xl p-4 space-y-3 border border-primary/30">
            <h3 className="font-black text-foreground text-sm flex items-center gap-2">
              <Clock size={16} className="text-primary" /> Confirmar Retiro Estándar
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Tokens a debitar:</span><span className="font-bold text-foreground">{amount.toLocaleString()} TKN</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recibirás en tu Wallet:</span><span className="font-black text-primary">{gramAmount} GRAM</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Wallet:</span><span className="font-mono text-foreground">{wallet.slice(0, 10)}...{wallet.slice(-6)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tiempo de acreditación:</span><span className="text-yellow-400 font-bold">24 – 48 horas</span></div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2.5 text-[11px] text-yellow-300/90 leading-relaxed">
              ⏳ Tu solicitud se encolará y será verificada por el sistema.
            </div>
          </div>
          <button onClick={submitStandard} className="w-full py-3.5 rounded-xl btn-gold text-xs font-black active:scale-95 transition-all shadow-md shadow-yellow-500/10">
            Confirmar Solicitud Estándar
          </button>
          <button onClick={() => setMode(null)} className="w-full py-2.5 rounded-xl text-xs font-bold text-muted-foreground bg-secondary/60 border border-border">
            Volver
          </button>
        </div>
      )}

      {/* Confirmación: Retiro Express */}
      {mode === 'express' && (
        <div className="px-4 space-y-4">
          <div className="bg-card rounded-2xl p-4 space-y-3 border border-green-500/30">
            <h3 className="font-black text-foreground text-sm flex items-center gap-2">
              <Zap size={16} className="text-green-400" /> Confirmar Retiro Express
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Tokens a debitar:</span><span className="font-bold text-foreground">{amount.toLocaleString()} TKN</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recibirás en tu Wallet:</span><span className="font-black text-primary">{gramAmount} GRAM</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Wallet:</span><span className="font-mono text-foreground">{wallet.slice(0, 10)}...{wallet.slice(-6)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tiempo de acreditación:</span><span className="text-green-400 font-bold">Inmediato ⚡</span></div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2.5 text-[11px] text-green-300/90 leading-relaxed">
              📺 Mira 2 anuncios cortos de AdsGram y tu pago será procesado con prioridad máxima de inmediato.
            </div>
          </div>
          <button onClick={submitExpress}
            className="w-full py-3.5 rounded-xl text-xs font-black active:scale-95 transition-all shadow-md shadow-green-500/10"
            style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)', color: 'white' }}>
            📺 Ver 2 Anuncios y Retirar Ahora
          </button>
          <button onClick={() => setMode(null)} className="w-full py-2.5 rounded-xl text-xs font-bold text-muted-foreground bg-secondary/60 border border-border">
            Volver
          </button>
        </div>
      )}

      {/* Historial de Retiros */}
      {withdrawals.length > 0 && step === 'form' && !mode && (
        <div className="px-4 mt-6">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Wallet size={13} className="text-muted-foreground" />
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Historial de Retiros
            </h2>
          </div>

          <div className="space-y-2">
            {withdrawals.map(w => (
              <div key={w.id} className="bg-card rounded-xl px-3 py-2.5 flex items-center gap-3 border border-border/40">
                {w.status === 'completed'
                  ? <CheckCircle2 size={15} className="text-green-400 shrink-0" />
                  : w.status === 'failed'
                  ? <AlertCircle size={15} className="text-red-400 shrink-0" />
                  : <Clock size={15} className="text-yellow-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    {w.token_amount?.toLocaleString()} TKN → <span className="text-primary font-black">{w.ton_amount || (w.token_amount / GRAM_RATE).toFixed(2)} GRAM</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{w.wallet_address}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                  w.status === 'completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  w.status === 'failed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {w.status === 'completed' ? 'Enviado' : w.status === 'failed' ? 'Fallido' : 'En cola'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
