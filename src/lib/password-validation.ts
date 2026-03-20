export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'debil' | 'media' | 'fuerte';
  score: number; // 0-5
}

/**
 * Valida una contrasena segun la politica de seguridad.
 * Requisitos:
 * - Minimo 8 caracteres
 * - Al menos 1 mayuscula
 * - Al menos 1 minuscula
 * - Al menos 1 numero
 * - Al menos 1 caracter especial (!@#$%^&*)
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  if (password.length >= 8) {
    score++;
  } else {
    errors.push('Debe tener al menos 8 caracteres');
  }

  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    errors.push('Debe incluir al menos 1 letra mayuscula');
  }

  if (/[a-z]/.test(password)) {
    score++;
  } else {
    errors.push('Debe incluir al menos 1 letra minuscula');
  }

  if (/[0-9]/.test(password)) {
    score++;
  } else {
    errors.push('Debe incluir al menos 1 numero');
  }

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score++;
  } else {
    errors.push('Debe incluir al menos 1 caracter especial (!@#$%^&*)');
  }

  let strength: 'debil' | 'media' | 'fuerte';
  if (score <= 2) {
    strength = 'debil';
  } else if (score <= 4) {
    strength = 'media';
  } else {
    strength = 'fuerte';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
    score,
  };
}

/**
 * Retorna el color CSS para el indicador de fortaleza.
 */
export function getStrengthColor(strength: 'debil' | 'media' | 'fuerte'): string {
  switch (strength) {
    case 'debil':
      return 'bg-red-500';
    case 'media':
      return 'bg-yellow-500';
    case 'fuerte':
      return 'bg-green-500';
  }
}

/**
 * Retorna la etiqueta en espanol para la fortaleza.
 */
export function getStrengthLabel(strength: 'debil' | 'media' | 'fuerte'): string {
  switch (strength) {
    case 'debil':
      return 'Debil';
    case 'media':
      return 'Media';
    case 'fuerte':
      return 'Fuerte';
  }
}

/**
 * Retorna el color del texto para la fortaleza.
 */
export function getStrengthTextColor(strength: 'debil' | 'media' | 'fuerte'): string {
  switch (strength) {
    case 'debil':
      return 'text-red-500';
    case 'media':
      return 'text-yellow-500';
    case 'fuerte':
      return 'text-green-500';
  }
}
