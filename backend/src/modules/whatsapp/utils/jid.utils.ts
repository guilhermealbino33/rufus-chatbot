/**
 * WhatsApp JID (Jabber ID) Utilities
 *
 * Handles normalization and extraction of WhatsApp identifiers.
 * Supports both traditional @c.us format and new @lid format for multi-device.
 */

/**
 * Normaliza um identificador do WhatsApp para o formato correto
 *
 * @param input - Pode ser um JID completo (@lid/@c.us) ou número puro
 * @returns JID normalizado
 *
 * @example
 * normalizeJid('5548991426316') // '5548991426316@c.us'
 * normalizeJid('5548991426316@c.us') // '5548991426316@c.us'
 * normalizeJid('257431800180973@lid') // '257431800180973@lid'
 */
export function normalizeJid(input: string): string {
  if (!input) {
    throw new Error('JID input cannot be empty');
  }

  const trimmed = input.trim();

  // Se já tem sufixo @lid ou @c.us, retorna como está
  if (trimmed.endsWith('@lid') || trimmed.endsWith('@c.us')) {
    return trimmed;
  }

  // Se já tem @ mas não é @lid nem @c.us, pode ser @g.us (grupo) ou outro formato
  if (trimmed.includes('@')) {
    return trimmed;
  }

  // Se é apenas número, adiciona @c.us
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length >= 10) {
    return `${digitsOnly}@c.us`;
  }

  throw new Error(`Invalid JID format: ${input}`);
}

/**
 * Extrai o número de telefone de um JID se possível
 *
 * @param jid - JID completo (ex: '5548991426316@c.us' ou '257431800180973@lid')
 * @returns Número extraído ou null se não for possível extrair
 *
 * @example
 * extractPhoneFromJid('5548991426316@c.us') // '5548991426316'
 * extractPhoneFromJid('257431800180973@lid') // '257431800180973'
 */
export function extractPhoneFromJid(jid: string): string | null {
  if (!jid) return null;

  // Remove sufixos conhecidos
  const cleaned = jid
    .replace('@c.us', '')
    .replace('@lid', '')
    .replace('@g.us', '')
    .replace('@s.whatsapp.net', '');

  // Extrai apenas dígitos
  const digitsOnly = cleaned.replace(/\D/g, '');

  return digitsOnly.length >= 10 ? digitsOnly : null;
}

/**
 * Verifica se um JID é do tipo LID (Local Identifier)
 *
 * @param jid - JID completo
 * @returns true se for um LID, false caso contrário
 *
 * @example
 * isLidJid('257431800180973@lid') // true
 * isLidJid('5548991426316@c.us') // false
 */
export function isLidJid(jid: string): boolean {
  return jid?.endsWith('@lid') ?? false;
}

/**
 * Extrai número de telefone de um formattedName (ex: "+55 48 9142-6316")
 *
 * @param formattedName - Nome formatado contendo número de telefone
 * @returns Número extraído (apenas dígitos) ou null
 *
 * @example
 * extractPhoneFromFormattedName('+55 48 9142-6316') // '5548991426316'
 * extractPhoneFromFormattedName('+55 (48) 99142-6316') // '554899142631'
 * extractPhoneFromFormattedName('John Doe') // null
 */
export function extractPhoneFromFormattedName(formattedName: string): string | null {
  if (!formattedName) return null;

  // Remove todos os caracteres não numéricos
  const digitsOnly = formattedName.replace(/\D/g, '');

  // Valida se tem pelo menos 10 dígitos (DDD + número)
  // Formato brasileiro: 11 dígitos com código do país (55) ou 10-11 sem
  if (digitsOnly.length >= 10) {
    return digitsOnly;
  }

  return null;
}

/**
 * Tenta resolver o melhor JID possível a partir de múltiplas fontes
 *
 * @param primaryJid - JID principal (geralmente do campo 'from' ou 'to')
 * @param fallbackPhone - Número de telefone de fallback
 * @param formattedName - Nome formatado opcional
 * @returns JID normalizado
 *
 * @example
 * resolveJid('257431800180973@lid') // '257431800180973@lid'
 * resolveJid(undefined, '5548991426316') // '5548991426316@c.us'
 * resolveJid(undefined, undefined, '+55 48 9142-6316') // '5548991426316@c.us'
 */
export function resolveJid(
  primaryJid?: string,
  fallbackPhone?: string,
  formattedName?: string,
): string {
  // Tenta usar o JID primário
  if (primaryJid) {
    try {
      return normalizeJid(primaryJid);
    } catch {
      // Se falhar, continua para fallbacks
    }
  }

  // Tenta usar o telefone de fallback
  if (fallbackPhone) {
    try {
      return normalizeJid(fallbackPhone);
    } catch {
      // Se falhar, continua para próximo fallback
    }
  }

  // Tenta extrair do formattedName
  if (formattedName) {
    const extractedPhone = extractPhoneFromFormattedName(formattedName);
    if (extractedPhone) {
      return normalizeJid(extractedPhone);
    }
  }

  throw new Error('Unable to resolve JID from provided inputs');
}
