/**
 * lib/logging.ts
 * Safe logging utilities that prevent PHI leakage
 */

export interface SafeLogOptions {
  redactValues?: boolean;
  maxTextLength?: number;
}

const DEFAULT_OPTIONS: SafeLogOptions = {
  redactValues: true,
  maxTextLength: 200
};

/**
 * Redact sensitive portions of text while keeping structure visible
 */
function redactText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) {
    return text.substring(0, 50) + '...[REDACTED]...' + text.substring(text.length - 50);
  }
  return text.substring(0, 50) + `...[REDACTED ${text.length} chars]...` + text.substring(text.length - 50);
}

/**
 * Redact numeric lab values from test data
 */
function redactLabValue(value: any): string {
  if (typeof value === 'number') return '[REDACTED_NUMBER]';
  if (typeof value === 'string' && /\d/.test(value)) return '[REDACTED_VALUE]';
  return String(value);
}

/**
 * Safe logging for API requests/responses
 */
export function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: any, options: SafeLogOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const timestamp = new Date().toISOString();
  const logEntry: any = { timestamp, level, message };

  if (data) {
    // Redact sensitive fields
    const safeData: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'extractedText' && typeof value === 'string') {
        safeData[key] = redactText(value, opts.maxTextLength!);
      } else if (key === 'tests' && Array.isArray(value)) {
        safeData[key] = value.map((test: any) => ({
          ...test,
          value_numeric: opts.redactValues ? '[REDACTED]' : test.value_numeric,
          value_string: opts.redactValues ? redactLabValue(test.value_string) : test.value_string
        }));
      } else if (key === 'patientContext') {
        // Only log non-identifying metadata
        safeData[key] = {
          age_group: (value as any).age < 18 ? '<18' : (value as any).age >= 65 ? '65+' : '18-64',
          sex_provided: !!(value as any).sex_at_birth,
          symptoms_count: (value as any).symptoms?.length || 0
        };
      } else if (key.includes('api') || key.includes('key') || key.includes('token')) {
        safeData[key] = '[REDACTED_CREDENTIAL]';
      } else {
        safeData[key] = value;
      }
    }
    
    logEntry.data = safeData;
  }

  // In production, send to proper logging service
  // For now, console with clear formatting
  console[level](`[${level.toUpperCase()}] ${message}`, logEntry.data || '');
  
  return logEntry;
}

export const logger = {
  info: (msg: string, data?: any, opts?: SafeLogOptions) => safeLog('info', msg, data, opts),
  warn: (msg: string, data?: any, opts?: SafeLogOptions) => safeLog('warn', msg, data, opts),
  error: (msg: string, data?: any, opts?: SafeLogOptions) => safeLog('error', msg, data, opts),
};
