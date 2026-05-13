/**
 * Traduce mensajes crudos de error de Supabase Auth a las claves i18n
 * de `authErrors.*` correspondientes. Si no encuentra match, devuelve el
 * mensaje original para no perder señal de errores raros.
 *
 * Uso:
 *   import { translateAuthError } from '@/lib/translateAuthError';
 *   const friendly = translateAuthError(rawError, t);
 *   toast.error(friendly);
 */
export function translateAuthError(
  rawMessage: string | undefined | null,
  t: (key: string) => string
): string {
  const msg = (rawMessage || '').toLowerCase().trim();
  if (!msg) return t('authErrors.loginError');

  if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
    return t('authErrors.invalidCredentials');
  }
  if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
    return t('authErrors.emailNotConfirmed');
  }
  if (msg.includes('user already registered') || msg.includes('already exists')) {
    return t('authErrors.userAlreadyExists');
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) {
    return t('authErrors.tooManyRequests');
  }
  if (msg.includes('user not found') || msg.includes('no user found')) {
    return t('authErrors.userNotFound');
  }
  if (msg.includes('weak password') || msg.includes('password should')) {
    return t('authErrors.weakPassword');
  }

  // Fallback: si no reconocemos el mensaje, devolvemos el genérico traducido.
  return rawMessage || t('authErrors.loginError');
}
