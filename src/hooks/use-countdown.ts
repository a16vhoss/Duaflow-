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

      // Fetch ALL active schedules in a single query
      const { data: allSchedules } = await supabase
        .from('corte_schedules')
        .select('dia_semana, hora_corte')
        .eq('activo', true)
        .order('dia_semana', { ascending: true })
        .order('hora_corte', { ascending: true });

      if (!allSchedules || allSchedules.length === 0) return;

      // Find today's remaining schedules
      const todayRemaining = allSchedules.filter(
        (s) => s.dia_semana === diaSemana && s.hora_corte > horaActual
      );

      if (todayRemaining.length > 0) {
        setNextCorte(todayRemaining[0].hora_corte);
      } else {
        // Find next day's first schedule
        for (let i = 1; i <= 7; i++) {
          const nextDay = (diaSemana + i) % 7;
          const nextDaySchedules = allSchedules.filter((s) => s.dia_semana === nextDay);
          if (nextDaySchedules.length > 0) {
            setNextCorte(`+${i}d ${nextDaySchedules[0].hora_corte}`);
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
