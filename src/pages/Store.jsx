import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, shopDB, transactionDB } from '@/lib/db'
import { processPurchase } from '@/lib/finance'
import { showAd } from '@/lib/adsgram'
import { processAdReward } from '@/lib/finance'
import { ArrowLeft, Zap, CheckCircle, Tv } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CONFIG } from '@/lib/config'

// Packs predefinidos de tokens (pagados con TON)
const TOKEN_PACKS = [
  { id: 'pack_500', name: 'Pack Starter', tokens: 500, ton: 0.5, emoji: '🪙', popular: false },
  { id: 'pack_2000', name: 'Pack Popular', tokens: 2000, ton: 1.5, emoji: '💎', popular: true },
  { id: 'pack_10000', name: 'Pack Pro', tokens: 10000, ton: 5.0, emoji: '👑', popular: false },
]

// Potenciadores (comprados con tokens internos)
const BOOSTS = [
  { id: 'double_pts', name: 'Doble Puntos', description: '2x puntos en tu próxima partida', price: 500, emoji: '⚡' },
  { id: 'vip_pass', name: 'VIP Pass 7d', description: '+10% payout en todos los juegos', price: 2000, emoji: '💼' },
  { id: 'lucky_charm', name: 'Amuleto de Suerte', description: 'Aumenta tu mejor racha por 3', price: 800, emoji: '🍀' },
]

export default function Store() {
  const [user, setUser] = useState(null)
  const [buying, setBuying] = useState(null)
  const [purchased, setPurchased] = useState([])
  const [watchingAd, setWatchingAd] = useState(false)
  const [adMessage, setAdMessage] = useState(null)

  useEffect(() => { loadUser() }, [])

  const loadUser = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) setUser(u)
  }

  // ── Comprar tokens con TON ────────────────────────────────
  const buyTokenPack = async (pack) => {
    if (!user || buying) return
    setBuying(pack.id)

    // TODO: Aquí va TonConnect para enviar pack.ton TON a BANK_WALLET
    // Por ahora simulamos el pago (para testing)
    // En producción: await sendTonPayment({ connector, toAddress: CONFIG.BANK_WALLET, amount: pack.ton })

    const { newBalance } = await processPurchase({
      userId: user.id,
      tonPaid: pack.ton,
      tokensToCredit: pack.tokens,
      currentBalance: user.tokens,
    })

    setUser(prev => ({ ...prev, tokens: newBalance }))
    setPurchased(prev => [...prev, pack.id])
    setBuying(null)
  }

  // ── Ver anuncio y ganar tokens ────────────────────────────
  const watchAd = () => {
    if (watchingAd) return
    setWatchingAd(true)
    setAdMessage(null)

    showAd({
      onReward: async () => {
        const { newBalance } = await processAdReward({
          userId: user.id,
          currentBalance: user.tokens,
        })
        setUser(prev => ({ ...prev, tokens: newBalance }))
        setAdMessage(`¡Ganaste ${CONFIG.TOKENS_PER_AD} TOKENS! 🎉`)
        setWatchingAd(false)
      },
      onSkip: () => {
        setAdMessage('Debes ver el anuncio completo para ganar tokens.')
        setWatchingAd(false)
      },
      onError: (err) => {
        setAdMessage('No hay anuncios disponibles en este momento.')
        setWatchingAd(false)
      },
    })
  }

  // ── Comprar boost con tokens ──────────────────────────────
  const buyBoost = async (boost) => {
    if (!user || buying || user.tokens < boost.price) return
    setBuying(boost.id)
    const newBalance = user.tokens - boost.price
    await userDB.update(user.id, { tokens: newBalance })
    await transactionDB.create({
      userId: user.id,
      amount: boost.price,
      type: 'debit',
      source: `boost_${boost.id}`,
      balanceAfter: newBalance,
    })
    setUser(prev => ({ ...prev, tokens: newBalance }))
    setPurchased(prev => [...prev, boost.id])
    setBuying(null)
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link to="/" className="w-9 h-9 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-black text-foreground">Tienda</h1>
        <div className="ml-auto bg-secondary/80 border border-primary/20 rounded-xl px-3 py-1.5">
          <span className="text-sm font-bold text-primary">{(user?.tokens || 0).toLocaleString()} TKN</span>
        </div>
      </div>

      {/* Ver anuncios → tokens */}
      <div className="px-4 mb-5">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(0,188,212,0.08)', border: '1px solid rgba(0,188,212,0.3)' }}>
          <div className="flex items-center gap-3 mb-3">
            <Tv size={20} className="text-accent" />
            <div>
              <p className="text-sm font-black text-foreground">Ver Anuncio → +{CONFIG.TOKENS_PER_AD} TOKENS</p>
              <p className="text-[10px] text-muted-foreground">Gana tokens gratis mirando anuncios cortos</p>
            </div>
          </div>
          {adMessage && (
            <p className={`text-xs mb-2 font-bold ${adMessage.includes('Ganaste') ? 'text-green-400' : 'text-yellow-400'}`}>{adMessage}</p>
          )}
          <button onClick={watchAd} disabled={watchingAd}
            className="w-full py-3 rounded-xl font-black text-sm tracking-wider transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #00bcd4, #0097a7)', color: 'white' }}>
            {watchingAd ? '⏳ Cargando anuncio...' : '📺 Ver Anuncio Gratis'}
          </button>
        </div>
      </div>

      {/* Packs de tokens con TON */}
      <div className="px-4 mb-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Comprar Tokens con TON
        </h2>
        <div className="space-y-2">
          {TOKEN_PACKS.map(pack => (
            <div key={pack.id} className="bg-card rounded-xl p-4 flex items-center gap-3 relative" style={{ border: pack.popular ? '1px solid rgba(212,160,23,0.5)' : '1px solid rgba(212,160,23,0.15)' }}>
              {pack.popular && (
                <div className="absolute -top-2 right-4 bg-primary text-primary-foreground text-[9px] font-black px-2 py-0.5 rounded-full">POPULAR</div>
              )}
              <span className="text-2xl">{pack.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{pack.name}</p>
                <p className="text-[11px] text-muted-foreground">{pack.tokens.toLocaleString()} TOKENS</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-accent">{pack.ton} TON</p>
                {purchased.includes(pack.id) ? (
                  <div className="mt-1 flex items-center gap-1 text-green-400 text-[10px] font-bold">
                    <CheckCircle size={12} /> Comprado
                  </div>
                ) : (
                  <button onClick={() => buyTokenPack(pack)} disabled={buying === pack.id}
                    className="mt-1 px-3 py-1 rounded-lg text-[10px] font-bold btn-gold disabled:opacity-50 active:scale-95 transition-all">
                    {buying === pack.id ? '...' : 'Comprar'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">* Pago vía TON wallet · Integración TonConnect próximamente activa</p>
      </div>

      {/* Potenciadores con tokens */}
      <div className="px-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Potenciadores con TOKENS</h2>
        <div className="space-y-2">
          {BOOSTS.map(boost => (
            <div key={boost.id} className="bg-card rounded-xl p-3 flex items-center gap-3" style={{ border: '1px solid rgba(212,160,23,0.15)' }}>
              <span className="text-2xl">{boost.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{boost.name}</p>
                <p className="text-[11px] text-muted-foreground">{boost.description}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end mb-1">
                  <Zap size={11} className="text-primary" />
                  <p className="text-xs font-bold text-primary">{boost.price.toLocaleString()}</p>
                </div>
                {purchased.includes(boost.id) ? (
                  <CheckCircle size={14} className="text-green-400 ml-auto" />
                ) : (
                  <button onClick={() => buyBoost(boost)}
                    disabled={buying === boost.id || (user?.tokens || 0) < boost.price}
                    className="px-3 py-1 rounded-lg text-[10px] font-bold btn-gold disabled:opacity-40 active:scale-95 transition-all">
                    {buying === boost.id ? '...' : 'Comprar'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}