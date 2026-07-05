import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const QUICK_BETS = [50, 100, 250, 500];

export default function BetControls({ balance, onBet, disabled }) {
  const [amount, setAmount] = useState(100);

  const change = (delta) => {
    setAmount(prev => Math.max(10, Math.min(balance, prev + delta)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => change(-50)}
          disabled={disabled || amount <= 10}
          className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground disabled:opacity-40 active:scale-95 transition-transform"
        >
          <Minus size={16} />
        </button>
        <div className="flex-1 text-center">
          <div className="bg-secondary/60 border border-primary/20 rounded-xl py-2">
            <span className="text-lg font-bold text-primary">{amount.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground ml-1">fichas</span>
          </div>
        </div>
        <button
          onClick={() => change(50)}
          disabled={disabled || amount >= balance}
          className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground disabled:opacity-40 active:scale-95 transition-transform"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex gap-2">
        {QUICK_BETS.map(v => (
          <button
            key={v}
            onClick={() => setAmount(Math.min(balance, v))}
            disabled={disabled}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
              amount === v
                ? 'bg-primary/20 border-primary/50 text-primary'
                : 'bg-secondary border-border text-muted-foreground'
            }`}
          >
            {v}
          </button>
        ))}
        <button
          onClick={() => setAmount(balance)}
          disabled={disabled}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-accent/40 bg-accent/10 text-accent transition-all active:scale-95"
        >
          MAX
        </button>
      </div>
      <div className="text-center text-xs text-muted-foreground">
        Balance: <span className="text-foreground font-medium">{balance?.toLocaleString()}</span> fichas
      </div>
    </div>
  );
}