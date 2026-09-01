import { CONFIG } from './config'

export function showAd({ onReward, onSkip, onError }) {
  if (!window.Adsgram) {
    console.warn('[Adsgram] SDK not loaded')
    if (onError) onError('SDK not loaded')
    return
  }
  const blockId = CONFIG.ADSGRAM_BLOCK_ID
  if (!blockId || blockId === 'YOUR_BLOCK_ID') {
    console.warn('[Adsgram] No Block ID configured')
    if (onError) onError('No Block ID')
    return
  }
  const AdController = window.Adsgram.init({ blockId })
  AdController.show()
    .then((result) => {
      // Según la documentación oficial de Adsgram, la promesa SOLO se resuelve
      // (entra aquí) si el usuario vio el anuncio completo. Cualquier otro caso
      // (error o el usuario lo saltó) cae en el .catch() de abajo.
      if (onReward) onReward(result)
    })
    .catch((result) => {
      // Puede ser que el usuario haya cerrado el anuncio antes de terminar,
      // o que haya ocurrido un error real. Distinguimos usando result.error.
      if (result?.error) {
        if (onError) onError(result)
      } else {
        if (onSkip) onSkip(result)
      }
    })
}

export function showDoubleAd({ onComplete, onFail }) {
  let adsSeen = 0
  const showNext = () => {
    showAd({
      onReward: () => {
        adsSeen++
        if (adsSeen >= 2) onComplete()
        else setTimeout(showNext, 1000)
      },
      onSkip: () => onFail('El usuario saltó el anuncio'),
      onError: (err) => onFail(err),
    })
  }
  showNext()
}
