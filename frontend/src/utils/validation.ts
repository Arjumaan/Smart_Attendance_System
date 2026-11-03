/**
 * Enterprise Form Validation Utilities
 * Validates email and password inputs with user-friendly error messages.
 */

export interface ValidationResult {
  isValid: boolean;
  message: string;
}

// RFC 5322 standard email format pattern
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Corporate Employee ID pattern (e.g. EMP001, EMP2104, EMP0307)
export const EMPLOYEE_ID_REGEX = /^EMP\d{2,}$/i;

/**
 * Validate pure corporate email fields (e.g. Employee Registration)
 * Flags invalid inputs like '1234' with 'Please enter a proper email ID'.
 */
export const validateEmail = (value: string): ValidationResult => {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      message: 'Email address is required.',
    };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return {
      isValid: false,
      message: 'Please enter a proper email ID (e.g. name@company.com).',
    };
  }
  return { isValid: true, message: '' };
};

/**
 * Validate dual-mode login identifier (Corporate Email or Employee ID)
 * Supports both corporate email (admin@company.com) and Employee ID (EMP001).
 * If a non-matching string like '1234' is entered, flags with clear guidance.
 */
export const validateLoginIdentifier = (value: string): ValidationResult => {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      message: 'Corporate email or Employee ID is required.',
    };
  }

  // If input contains '@', strictly validate as email address
  if (trimmed.includes('@')) {
    if (!EMAIL_REGEX.test(trimmed)) {
      return {
        isValid: false,
        message: 'Please enter a proper email ID (e.g. name@company.com).',
      };
    }
    return { isValid: true, message: '' };
  }

  // If input does not contain '@', check if it's a valid Employee ID format
  if (EMPLOYEE_ID_REGEX.test(trimmed)) {
    return { isValid: true, message: '' };
  }

  // If it's neither (e.g. user typed '1234' or random string)
  return {
    isValid: false,
    message: 'Please enter a proper email ID (e.g. name@company.com) or Employee ID (e.g. EMP001).',
  };
};

/**
 * Validate login password (sign-in credential check)
 */
export const validateLoginPassword = (value: string): ValidationResult => {
  if (!value) {
    return {
      isValid: false,
      message: 'Password is required.',
    };
  }
  if (value.length < 6) {
    return {
      isValid: false,
      message: 'Password must be at least 6 characters.',
    };
  }
  return { isValid: true, message: '' };
};

/**
 * Validate enterprise password complexity policy for new accounts and resets:
 * - At least 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 digit (0-9)
 * - At least 1 special symbol (!@#$%^&*...)
 */
export const validateStrongPassword = (value: string): ValidationResult => {
  if (!value) {
    return {
      isValid: false,
      message: 'Password is required.',
    };
  }
  if (value.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long.',
    };
  }
  if (!/[A-Z]/.test(value)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter (A-Z).',
    };
  }
  if (!/[a-z]/.test(value)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter (a-z).',
    };
  }
  if (!/\d/.test(value)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number (0-9).',
    };
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return {
      isValid: false,
      message: 'Password must contain at least one special symbol (!@#$%^&*...).',
    };
  }
  return { isValid: true, message: '' };
};
