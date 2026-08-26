// Traduce el resultado de boostDB.processGameBoosts() en mensajes claros para el jugador.
// Puede devolver varias notificaciones si se activó más de un potenciador a la vez.

export function getBoostNotifications({ boostResult, betAmount, basePoints }) {
  const notifications = []
  if (!boostResult) return notifications

  const { shieldUsed, boostBonusTokens, finalPoints, activeBoosts } = boostResult

  // 🛡️ Escudo Anti-Pérdida
  if (shieldUsed) {
    notifications.push({
      emoji: '🛡️',
      title: 'Escudo Anti-Pérdida Activado',
      message: `Se protegieron tus ${betAmount.toLocaleString()} TOKENS de esta partida perdedora. Tu escudo se ha consumido.`,
    })
  }

  // 🍀 Amuleto de Suerte / 👑 Pase VIP (bono de tokens en victoria)
  if (boostBonusTokens > 0) {
    const hasLucky = activeBoosts?.some(b => b.boost_type === 'lucky_charm')
    const hasVip = activeBoosts?.some(b => b.boost_type === 'vip_pass')
    const names = []
    if (hasLucky) names.push('Amuleto de Suerte (+15%)')
    if (hasVip) names.push('Pase VIP (+10%)')

    notifications.push({
      emoji: hasVip ? '👑' : '🍀',
      title: names.length ? names.join(' + ') : 'Bono de Potenciador',
      message: `¡Ganaste +${boostBonusTokens.toLocaleString()} TOKENS extra gracias a tu potenciador activo!`,
    })
  }

  // ⚡ Doble Puntos (VIP o Doble PTS)
  if (finalPoints > basePoints) {
    notifications.push({
      emoji: '⚡',
      title: 'Doble Puntos Activado',
      message: `Tus puntos de ranking se duplicaron en esta partida: +${finalPoints.toLocaleString()} PTS.`,
    })
  }

  return notifications
}
