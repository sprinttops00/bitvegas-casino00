export const TONCONNECT_CONFIG = {
  ENABLED: false,
  MANIFEST_URL: 'https://tuapp.pages.dev/tonconnect-manifest.json',
}

export async function sendTonPayment({ connector, toAddress, amount, comment }) {
  if (!TONCONNECT_CONFIG.ENABLED) {
    console.warn('[TonConnect] Disabled. Set ENABLED: true in tonconnect.js after installing @tonconnect/ui-react')
    return { success: false, reason: 'disabled' }
  }
  const tx = {
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [{
      address: toAddress,
      amount: String(Math.floor(amount * 1e9)),
      payload: comment ? btoa(unescape(encodeURIComponent(comment))) : undefined,
    }],
  }
  const result = await connector.sendTransaction(tx)
  return { success: true, result }
}