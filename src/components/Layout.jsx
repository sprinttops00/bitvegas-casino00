import { Outlet, NavLink } from 'react-router-dom';
import { Home, ShoppingBag, ArrowUpFromLine, CheckSquare, Trophy } from 'lucide-react';

const navItems = [
  { to: '/tasks', icon: CheckSquare, label: 'TAREAS', emoji: '⚡' },
  { to: '/store', icon: ShoppingBag, label: 'TIENDA', emoji: '🛒' },
  { to: '/', icon: Home, label: 'INICIO', emoji: '🏠', center: true },
  { to: '/withdraw', icon: ArrowUpFromLine, label: 'RETIRAR', emoji: '💰' },
  { to: '/ranking', icon: Trophy, label: 'RANKING', emoji: '🏆' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none max-w-md mx-auto left-0 right-0">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <main className="flex-1 pb-24 relative z-10">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50">
        <div className="backdrop-blur-xl border-t border-border/30 px-2 py-2" style={{ background: 'rgba(13,7,4,0.97)' }}>
          <div className="flex items-center justify-around">
            {navItems.map(({ to, emoji, label, center }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className="flex flex-col items-center gap-0.5 min-w-0"
              >
                {({ isActive }) => (
                  center ? (
                    <div className="flex flex-col items-center -mt-5">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg"
                        style={{
                          background: isActive
                            ? 'linear-gradient(135deg, #f6d365, #d4a017)'
                            : 'linear-gradient(135deg, #2a1a00, #1a0e00)',
                          border: `3px solid ${isActive ? '#d4a017' : 'rgba(212,160,23,0.4)'}`,
                          boxShadow: isActive ? '0 0 20px rgba(212,160,23,0.5)' : '0 4px 12px rgba(0,0,0,0.5)',
                        }}>
                        {emoji}
                      </div>
                      <span className="text-[9px] font-black mt-1" style={{ color: isActive ? '#d4a017' : 'rgba(255,255,255,0.4)' }}>{label}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5 px-1 py-1">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all"
                        style={{
                          background: isActive ? 'rgba(212,160,23,0.2)' : 'transparent',
                          border: isActive ? '1px solid rgba(212,160,23,0.4)' : '1px solid transparent',
                        }}>
                        {emoji}
                      </div>
                      <span className="text-[9px] font-black" style={{ color: isActive ? '#d4a017' : 'rgba(255,255,255,0.4)' }}>{label}</span>
                    </div>
                  )
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}