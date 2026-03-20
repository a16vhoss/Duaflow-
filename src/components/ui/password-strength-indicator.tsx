'use client';

import { validatePassword, getStrengthColor, getStrengthLabel, getStrengthTextColor } from '@/lib/password-validation';

interface PasswordStrengthIndicatorProps {
  password: string;
  /** Variant para fondos oscuros (broker) o claros (admin) */
  variant?: 'light' | 'dark';
}

export function PasswordStrengthIndicator({ password, variant = 'light' }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const { strength, score } = validatePassword(password);
  const barBg = variant === 'dark' ? 'bg-slate-700' : 'bg-slate-200';
  const errorTextColor = variant === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const checkColor = variant === 'dark' ? 'text-green-400' : 'text-green-600';

  return (
    <div className="space-y-2 mt-2">
      {/* Barra de fortaleza */}
      <div className="flex items-center gap-2">
        <div className={`flex-1 h-1.5 rounded-full ${barBg} overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${getStrengthColor(strength)}`}
            style={{ width: `${(score / 5) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${getStrengthTextColor(strength)}`}>
          {getStrengthLabel(strength)}
        </span>
      </div>

      {/* Lista de requisitos */}
      <ul className="space-y-0.5">
        {[
          { label: 'Min. 8 caracteres', met: password.length >= 8 },
          { label: '1 mayuscula', met: /[A-Z]/.test(password) },
          { label: '1 minuscula', met: /[a-z]/.test(password) },
          { label: '1 numero', met: /[0-9]/.test(password) },
          { label: '1 caracter especial (!@#$%^&*)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
        ].map((req) => (
          <li key={req.label} className={`text-[11px] flex items-center gap-1.5 ${req.met ? checkColor : errorTextColor}`}>
            <span>{req.met ? '\u2713' : '\u2717'}</span>
            {req.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
