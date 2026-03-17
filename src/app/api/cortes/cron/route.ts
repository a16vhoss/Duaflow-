import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// GET: Vercel cron endpoint for automatic cortes
export async function GET(req: NextRequest) {
  try {
    // Verify the request is from Vercel cron (optional security)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Allow if no CRON_SECRET is configured (dev mode)
      if (process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    // Use service role for cron operations (no user session)
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // Get current day of week and time
    const now = new Date();
    const daysOfWeek = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const currentDay = daysOfWeek[now.getDay()];
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMinute = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;

    // Check if there is a schedule matching today and this time
    const { data: schedules, error: scheduleError } = await supabase
      .from('corte_schedules')
      .select('*')
      .eq('activo', true)
      .contains('dias', [currentDay]);

    if (scheduleError) {
      return NextResponse.json({ error: scheduleError.message }, { status: 400 });
    }

    // Filter schedules that match the current time (within a 1-minute window)
    const matchingSchedules = (schedules || []).filter((s) => {
      return s.hora === currentTime;
    });

    if (matchingSchedules.length === 0) {
      return NextResponse.json({
        message: 'No hay cortes programados para este momento',
        checked_at: now.toISOString(),
        day: currentDay,
        time: currentTime,
      });
    }

    // Execute automatic corte for each matching schedule
    const results = [];

    for (const schedule of matchingSchedules) {
      // Get all pending containers not assigned to any corte
      const { data: pendingContainers, error: fetchError } = await supabase
        .from('containers')
        .select('*')
        .eq('estado', 'pendiente')
        .is('corte_id', null);

      if (fetchError) {
        results.push({ schedule_id: schedule.id, error: fetchError.message });
        continue;
      }

      if (!pendingContainers || pendingContainers.length === 0) {
        results.push({ schedule_id: schedule.id, message: 'Sin contenedores pendientes' });
        continue;
      }

      // Calculate totals
      const totalContenedores = pendingContainers.length;
      const totalPesoKg = pendingContainers.reduce(
        (sum, c) => sum + (c.peso_kg || 0),
        0
      );

      // Create the corte record
      const { data: corte, error: corteError } = await supabase
        .from('cortes')
        .insert({
          tipo: 'automatico',
          schedule_id: schedule.id,
          total_contenedores: totalContenedores,
          total_peso_kg: totalPesoKg,
          fecha_corte: new Date().toISOString(),
        })
        .select()
        .single();

      if (corteError) {
        results.push({ schedule_id: schedule.id, error: corteError.message });
        continue;
      }

      // Assign containers to this corte
      const containerIds = pendingContainers.map((c) => c.id);
      const { error: updateError } = await supabase
        .from('containers')
        .update({ corte_id: corte.id, estado: 'en_corte' })
        .in('id', containerIds);

      if (updateError) {
        results.push({ schedule_id: schedule.id, corte_id: corte.id, error: updateError.message });
        continue;
      }

      // Get distinct broker_ids
      const brokerIds = [...new Set(pendingContainers.map((c) => c.broker_id).filter(Boolean))];

      // Create corte_info notifications for each broker
      if (brokerIds.length > 0) {
        const notifications = brokerIds.map((brokerId) => {
          const brokerContainers = pendingContainers.filter((c) => c.broker_id === brokerId);
          return {
            corte_id: corte.id,
            broker_id: brokerId,
            total_contenedores: brokerContainers.length,
            total_peso_kg: brokerContainers.reduce((sum, c) => sum + (c.peso_kg || 0), 0),
            leido: false,
          };
        });

        const { error: notifError } = await supabase
          .from('corte_info')
          .insert(notifications);

        if (notifError) {
          console.error('Error creating corte_info notifications:', notifError.message);
        }
      }

      results.push({
        schedule_id: schedule.id,
        corte_id: corte.id,
        total_contenedores: totalContenedores,
        total_peso_kg: totalPesoKg,
        brokers_notificados: brokerIds.length,
      });
    }

    return NextResponse.json({
      executed_at: now.toISOString(),
      day: currentDay,
      time: currentTime,
      results,
    });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
