'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Progress } from '@ttt-productions/ui-core';
import type { CountdownTimerProps } from '../types.js';

/**
 * Countdown timer showing time remaining on a checked-out task.
 * Updates every 30 seconds. Shows a progress bar with color coding:
 * green > 50%, yellow > 25%, red < 25%.
 */
export function CountdownTimer({ expiresAtMillis, checkedOutAtMillis }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [percentLeft, setPercentLeft] = useState(100);

  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now();
      const totalDuration = expiresAtMillis - checkedOutAtMillis;
      const remaining = expiresAtMillis - now;

      if (remaining <= 0) {
        setTimeLeft('Expired');
        setPercentLeft(0);
        return;
      }

      const percentage = (remaining / totalDuration) * 100;
      setPercentLeft(Math.max(0, Math.min(100, percentage)));

      // Format as human-readable
      const totalMinutes = Math.ceil(remaining / 60_000);
      if (totalMinutes < 60) {
        setTimeLeft(`${totalMinutes}m left`);
      } else {
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        setTimeLeft(`${hours}h ${mins}m left`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 30_000);
    return () => clearInterval(interval);
  }, [expiresAtMillis, checkedOutAtMillis]);

  let progressColor = 'bg-success';
  if (percentLeft < 25) progressColor = 'bg-destructive';
  else if (percentLeft < 50) progressColor = 'bg-warning';

  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold">{timeLeft}</span>
        <Clock className="icon-xxs" />
      </div>
      <Progress value={percentLeft} className="h-1.5" indicatorClassName={progressColor} />
    </div>
  );
}
