import { Coins } from 'lucide-react';

export default function TopBar({ player, title }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-3">
      <div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {player && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {(player.points || 0).toLocaleString()} PTS · Racha: {player.streak || 0}
          </p>
        )}
      </div>
      {player && (
        <div className="flex items-center gap-2 bg-secondary/80 border border-primary/20 rounded-xl px-3 py-2 gold-glow">
          <Coins size={16} className="text-primary" />
          <span className="text-sm font-bold text-primary">
            {(player.balance || 0).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}