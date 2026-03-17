'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useCountdown() {
  const [nextCorte, setNextCorte] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('--:--:--');
  const supabase = createClient();

  useEffect(() => {
    async function fetchNextCorte() {
      const now = new Date();
      const diaSemana = now.getDay();
      const horaActual = now.toTimeString().slice(0, 8);

      // Get today's remaining schedules
      const { data: todaySchedules } = await supabase
        .from('corte_schedules')
        .select('hora_corte')
        .eq('dia_semana', diaSemana)
        .eq('activo', true)
        .gt('hora_corte', horaActual)
        .order('hora_corte', { ascending: true })
        .limit(1);

      if (todaySchedules && todaySchedules.length > 0) {
        setNextCorte(todaySchedules[0].hora_corte);
      } else {
        // Get next day's first schedule
        for (let i = 1; i <= 7; i++) {
          const nextDay = (diaSemana + i) % 7;
          const { data: nextSchedules } = await supabase
            .from('corte_schedules')
            .select('hora_corte')
            .eq('dia_semana', nextDay)
            .eq('activo', true)
            .order('hora_corte', { ascending: true })
            .limit(1);

          if (nextSchedules && nextSchedules.length > 0) {
            setNextCorte(`+${i}d ${nextSchedules[0].hora_corte}`);
            break;
          }
        }
      }
    }

    fetchNextCorte();
  }, []);

  useEffect(() => {
    if (!nextCorte) return;

    const interval = setInterval(() => {
      const now = new Date();

      let targetDate: Date;
      if (nextCorte.startsWith('+')) {
        const match = nextCorte.match(/\+(\d+)d\s(.+)/);
        if (!match) return;
        const days = parseInt(match[1]);
        const time = match[2];
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + days);
        const [h, m, s] = time.split(':').map(Number);
        targetDate.setHours(h, m, s || 0, 0);
      } else {
        targetDate = new Date(now);
        const [h, m, s] = nextCorte.split(':').map(Number);
        targetDate.setHours(h, m, s || 0, 0);
      }

      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [nextCorte]);

  return { timeLeft, nextCorte };
}
