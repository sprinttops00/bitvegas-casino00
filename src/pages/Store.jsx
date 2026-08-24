import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/telegramUser'
import { userDB, shopDB, transactionDB, boostDB } from '@/lib/db'
import { ArrowLeft, Zap, CheckCircle2, Clock, Coins, PackageCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import Avatar from '@/components/Avatar'

// ── PACKS DE TOKENS (Precios en GRAM) ────────────────────────────────
const TOKEN_PACKS = [
  { id: 'pack_500', name: 'Pack Starter', tokens: 500, gram: 0.5, emoji: '🪙', popular: false },
  { id: 'pack_2500', name: 'Pack Popular', tokens: 2500, gram: 2.0, emoji: '💎', popular: true },
  { id: 'pack_10000', name: 'Pack High Roller', tokens: 10000, gram: 7.0, emoji: '👑', popular: false },
  { id: 'pack_25000', name: 'Pack Whale', tokens: 25000, gram: 15.0, emoji: '🚀', popular: false },
]

// ── POTENCIADORES CON IMPACTO REAL EN EL JUEGO ────────────────────────
const BOOSTS = [
  {
    id: 'shield',
    name: 'Escudo Anti-Pérdida',
    description: 'Salva el 100% de tu apuesta si pierdes tu próxima partida.',
    gram: 1.0,
    tokenPrice: 1000,
    durationHours: 24,
    multiplier: 1.0,
    emoji: '🛡️',
    badge: '1 USO',
  },
  {
    id: 'double_pts',
    name: 'Doble Puntos (2X PTS)',
    description: 'Duplica todos los puntos de ranking que ganes en tus partidas por 24h.',
    gram: 0.5,
    tokenPrice: 500,
    durationHours: 24,
    multiplier: 2.0,
    emoji: '⚡',
    badge: '24 HORAS',
  },
  {
    id: 'lucky_charm',
    name: 'Amuleto de Suerte (+15% Win)',
    description: 'Gana un +15% de tokens extra en cada victoria durante 24 horas.',
    gram: 1.5,
    tokenPrice: 1500,
    durationHours: 24,
    multiplier: 1.15,
    emoji: '🍀',
    badge: '24 HORAS',
  },
  {
    id: 'vip_pass',
    name: 'Pase VIP (7 Días)',
    description: '2X Puntos + 10% extra de tokens en victorias durante 7 días completos.',
    gram: 3.0,
    tokenPrice: 3000,
    durationHours: 168,
    multiplier: 1.10,
    emoji: '👑',
    badge: '7 DÍAS',
  },
]

function formatRemainingTime(expiresAt) {
  const diff = new Date(expiresAt) - new Date()
  if (diff <= 0) return 'Expirado'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h restantes`
  }
  return `${hours}h ${minutes}m restantes`
}

export default function Store() {
  const [player, setPlayer] = useState(null)
  const [inventory, setInventory] = useState([])
  const [buying, setBuying] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const tgUser = getCurrentUser()
    const u = await userDB.findByTelegramId(tgUser.telegram_id)
    if (u) {
      setPlayer(u)
      const activeBoosts = await boostDB.getActiveByUser(u.id)
      setInventory(activeBoosts)
    }
  }

  const showNotification = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  // ── Comprar Pack de Tokens con GRAM ────────────────────────
  const buyTokenPack = async (pack) => {
    if (!player || buying) return
    setBuying(pack.id)

    try {
      const newBalance = (player.tokens || 0) + pack.tokens
      const updated = await userDB.update(player.id, { tokens: newBalance })

      await transactionDB.create({
        userId: player.id,
        amount: pack.tokens,
        type: 'credit',
        source: `buy_tokens_${pack.id}__gram:${pack.gram}`,
        balanceAfter: newBalance,
      })

      await shopDB.recordPurchase({
        userId: player.id,
        itemId: pack.id,
        price: pack.tokens,
        tokensReceived: pack.tokens,
      })

      setPlayer(updated)
      showNotification(`¡Recibiste +${pack.tokens.toLocaleString()} TOKENS! 🎉`)
    } catch (err) {
      console.error('Error al comprar tokens:', err)
    } finally {
      setBuying(null)
    }
  }

  // ── Comprar Potenciador con Tokens ─────────────────────────
  const buyBoostWithTokens = async (boost) => {
    if (!player || buying || (player.tokens || 0) < boost.tokenPrice) return
    setBuying(boost.id)

    try {
      const newBalance = player.tokens - boost.tokenPrice
      const updated = await userDB.update(player.id, { tokens: newBalance })

      await transactionDB.create({
        userId: player.id,
        amount: boost.tokenPrice,
        type: 'debit',
        source: `buy_boost_${boost.id}`,
        balanceAfter: newBalance,
      })

      // Guardar el boost en Supabase con su vencimiento
      await boostDB.add({
        userId: player.id,
        boostType: boost.id,
        multiplier: boost.multiplier,
        durationHours: boost.durationHours,
      })

      // Actualizar estado e inventario en vivo
      setPlayer(updated)
      const activeBoosts = await boostDB.getActiveByUser(player.id)
      setInventory(activeBoosts)
      showNotification(`¡Potenciador "${boost.name}" activado! ⚡`)
    } catch (err) {
      console.error('Error al comprar potenciador:', err)
    } finally {
      setBuying(null)
    }
  }

  // ── Comprar Potenciador con GRAM ───────────────────────────
  const buyBoostWithGram = async (boost) => {
    if (!player || buying) return
    setBuying(boost.id)

    try {
      // Guardar el boost en Supabase
      await boostDB.add({
        userId: player.id,
        boostType: boost.id,
        multiplier: boost.multiplier,
        durationHours: boost.durationHours,
      })

      await transactionDB.create({
        userId: player.id,
        amount: 0,
        type: 'credit',
        source: `buy_boost_gram_${boost.id}__gram:${boost.gram}`,
        balanceAfter: player.tokens,
      })

      const activeBoosts = await boostDB.getActiveByUser(player.id)
      setInventory(activeBoosts)
      showNotification(`¡Potenciador "${boost.name}" activado con GRAM! 🚀`)
    } catch (err) {
      console.error('Error al comprar potenciador con GRAM:', err)
    } finally {
      setBuying(null)
    }
  }

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
          <p className="text-[10px] text-muted-foreground font-bold">{(player?.points || 0).toLocaleString()} PTS</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">TOKENS</div>
          <div className="text-base font-black text-primary">{(player?.tokens || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Notificación flotante de compra exitosa */}
      {successMsg && (
        <div className="px-4 mb-3">
          <div className="bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-2 animate-bounce">
            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {/* ── SECCIÓN 1: INVENTARIO DE POTENCIADORES ───────────────── */}
      <div className="px-4 mb-5">
        <div className="rounded-2xl p-3.5" style={{ background: 'rgba(212,160,23,0.05)', border: '1px solid rgba(212,160,23,0.25)' }}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <PackageCheck size={16} className="text-primary" />
              <h2 className="text-xs font-black text-foreground uppercase tracking-wider">Mi Inventario</h2>
            </div>
            <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              {inventory.length} ACTIVO{inventory.length === 1 ? '' : 'S'}
            </span>
          </div>

          {inventory.length === 0 ? (
            <div className="py-3 text-center">
              <p className="text-xs text-muted-foreground">No tienes potenciadores activos.</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">¡Consigue uno abajo para potenciar tus ganancias y proteger tus apuestas!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inventory.map(item => {
                const boostInfo = BOOSTS.find(b => b.id === item.boost_type) || {
                  name: item.boost_type,
                  emoji: '⚡',
                  description: 'Potenciador activo',
                }
                return (
                  <div key={item.id} className="bg-card/90 rounded-xl p-2.5 flex items-center gap-2.5 border border-primary/20">
                    <span className="text-xl">{boostInfo.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{boostInfo.name}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-primary">
                        <Clock size={10} />
                        <span className="font-semibold">{formatRemainingTime(item.expires_at)}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black text-green-400 bg-green-500/10 border border-green-500/30">
                      ACTIVO
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SECCIÓN 2: PACKS DE TOKENS (GRAM) ────────────────────── */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Coins size={14} className="text-primary" />
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Comprar Tokens con GRAM
            </h2>
          </div>
        </div>

        <div className="space-y-2.5">
          {TOKEN_PACKS.map(pack => (
            <div key={pack.id} className="bg-card rounded-xl p-3.5 flex items-center gap-3 relative"
              style={{ border: pack.popular ? '1px solid rgba(212,160,23,0.6)' : '1px solid rgba(212,160,23,0.15)' }}>
              {pack.popular && (
                <div className="absolute -top-2 right-3 bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                  POPULAR
                </div>
              )}
              <span className="text-2xl">{pack.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">{pack.name}</p>
                <p className="text-[11px] text-primary font-black">+{pack.tokens.toLocaleString()} TOKENS</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-accent">{pack.gram} GRAM</p>
                <button onClick={() => buyTokenPack(pack)} disabled={buying === pack.id}
                  className="mt-1 px-3 py-1 rounded-lg text-[10px] font-black btn-gold disabled:opacity-50 active:scale-95 transition-all shadow-md shadow-yellow-500/10">
                  {buying === pack.id ? '...' : 'Comprar'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          * Pagos procesados vía red TON / GRAM
        </p>
      </div>

      {/* ── SECCIÓN 3: POTENCIADORES DISPONIBLES ─────────────────── */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-primary" />
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Potenciadores de Juego
            </h2>
          </div>
        </div>

        <div className="space-y-3">
          {BOOSTS.map(boost => {
            const hasEnoughTokens = (player?.tokens || 0) >= boost.tokenPrice
            return (
              <div key={boost.id} className="bg-card rounded-xl p-3.5 flex flex-col gap-2.5"
                style={{ border: '1px solid rgba(212,160,23,0.18)' }}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{boost.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-foreground">{boost.name}</p>
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-secondary text-primary border border-primary/20">
                        {boost.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{boost.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-accent">{boost.gram} GRAM</span>
                    <span className="text-[10px] text-muted-foreground">o</span>
                    <div className="flex items-center gap-0.5">
                      <Zap size={10} className="text-primary" />
                      <span className="text-xs font-bold text-primary">{boost.tokenPrice.toLocaleString()} TKN</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Botón comprar con Tokens */}
                    <button onClick={() => buyBoostWithTokens(boost)}
                      disabled={buying === boost.id || !hasEnoughTokens}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black btn-gold disabled:opacity-40 active:scale-95 transition-all">
                      {buying === boost.id ? '...' : 'Usar Tokens'}
                    </button>

                    {/* Botón comprar con GRAM */}
                    <button onClick={() => buyBoostWithGram(boost)}
                      disabled={buying === boost.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-secondary/80 text-accent hover:bg-secondary border border-accent/30 disabled:opacity-40 active:scale-95 transition-all">
                      {buying === boost.id ? '...' : 'GRAM'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
