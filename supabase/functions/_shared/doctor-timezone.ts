// Zona horaria del médico para los correos de citas.
// Las fechas se guardan en UTC; el servidor de funciones también corre en UTC, así que
// toLocaleString sin timeZone mostraba la hora UTC (6 h de más en CDMX).
// Fuente: doctor_schedule_ranges.timezone (igual que fn_doctor_timezone en la BD).

// deno-lint-ignore no-explicit-any
type Db = any

export const DEFAULT_TIMEZONE = 'America/Mexico_City'

export async function getDoctorTimezone(db: Db, doctorId: string): Promise<string> {
  try {
    const { data } = await db
      .from('doctor_schedule_ranges')
      .select('timezone')
      .eq('doctor_id', doctorId)
      .not('timezone', 'is', null)
      .order('is_active', { ascending: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    const tz = (data?.timezone || '').trim()
    if (tz) {
      // Valida que Intl la conozca; si no, se usa la de CDMX.
      new Intl.DateTimeFormat('es-MX', { timeZone: tz })
      return tz
    }
  } catch { /* se usa la de CDMX */ }
  return DEFAULT_TIMEZONE
}

/** «lunes, 5 de octubre de 2026, 10:00 a.m. hora de Ciudad de México» */
export function formatInTimezone(
  iso: string,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions = {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  },
): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  try {
    return d.toLocaleString('es-MX', { ...opts, timeZone, timeZoneName: 'shortGeneric' })
  } catch {
    try {
      return d.toLocaleString('es-MX', { ...opts, timeZone, timeZoneName: 'short' })
    } catch {
      return d.toLocaleString('es-MX', { ...opts, timeZone: DEFAULT_TIMEZONE, timeZoneName: 'short' })
    }
  }
}
