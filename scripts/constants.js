// ============================================
// CONSTANTES DO APLICATIVO
// Mantenha valores "mágicos" aqui em vez de espalhá-los pelo código.
// ============================================

// Combustível / consumo padrão (usado quando o usuário ainda não configurou)
export const PRECO_GASOLINA_PADRAO = 6.35;
export const CONSUMO_MEDIO_PADRAO = 10.0; // km/l

// Bounds de validação de rota (acima/abaixo disso é input claramente errado)
export const KM_MAX_POR_ROTA = 10000;
export const VALOR_MAX_POR_ROTA = 100000;

// Limites de UI
export const NOME_MOTORISTA_MAX_CHARS = 60;
export const PLATAFORMA_MAX_CHARS = 60;

// Tempos (ms)
export const NOTIFICACAO_DURACAO_MS = 3000;
export const NOTIFICACAO_ANIMACAO_MS = 300;
export const DEBOUNCE_PADRAO_MS = 400;
export const DEBOUNCE_META_MS = 600;
export const SW_CHECK_UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 1h
export const CALENDAR_SCROLL_DELAY_MS = 100;

// Intervalo "lógico" entre início e fim ao registrar rota sem horários explícitos
export const DURACAO_ROTA_PADRAO_MIN = 30;
