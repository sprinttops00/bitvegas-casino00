import { useState } from 'react'

// Avatar reutilizable: muestra la foto de perfil de Telegram cuando está
// disponible, y si no (o si falla al cargar) muestra la inicial del nombre
// con el estilo dorado del casino. Se usa en Lobby, Perfil y Ranking para
// que la foto aparezca siempre y se vea igual en todas partes.
export default function Avatar({ src, name = '?', size = 48, className = '' }) {
  const [error, setError] = useState(false)
  const initial = (name || '?')[0]?.toUpperCase() || '?'

  return (
    <div
      className={`rounded-2xl border-2 border-primary/50 overflow-hidden flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(circle at 35% 30%, rgba(212,160,23,0.4), rgba(0,0,0,0.6))',
        boxShadow: '0 0 16px rgba(212,160,23,0.3)',
      }}
    >
      {src && !error ? (
        <img
          src={src}
          alt="avatar"
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span className="font-black text-primary" style={{ fontSize: size * 0.4 }}>
          {initial}
        </span>
      )}
    </div>
  )
}
