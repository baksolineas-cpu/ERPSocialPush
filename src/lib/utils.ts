import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateCurp10(curp: string): string {
  return curp.substring(0, 10).toUpperCase();
}

/**
 * Limpia la respuesta de Gemini de marcas de markdown
 */
export const sanitizeGeminiJson = (text: string): string => {
  return text.replace(/```json|```|`|json/gi, "").trim();
};

export const VALIDATORS = {
  CURP: (val: string) => /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$/.test(val),
  NSS: (val: string) => /^[0-9]{11}$/.test(val),
  RFC: (val: string) => /^[A-Z]{4}[0-9]{6}[A-Z0-9]{3}$/.test(val)
};

export function extractBirthDateFromCurp(curp: string): string | null {
  if (curp.length < 10) return null;
  const yearPart = curp.substring(4, 6);
  const monthPart = curp.substring(6, 8);
  const dayPart = curp.substring(8, 10);
  
  const currentYear = new Date().getFullYear() % 100;
  const century = parseInt(yearPart) <= currentYear ? "20" : "19";
  return `${century}${yearPart}-${monthPart}-${dayPart}`;
}

export function calculateDetailedAge(curp: string) {
  const birthDateStr = extractBirthDateFromCurp(curp);
  if (!birthDateStr) return null;

  const birthDate = new Date(birthDateStr + 'T00:00:00');
  const today = new Date();
  
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    months--;
    const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += lastMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }

  // Lógica de Pensión: Si meses >= 6 y días >= 1 (o simplemente meses > 6)
  // El usuario dice: "X años y 6 meses + 1 día" -> X+1 años
  const hasRoundingBenefit = months > 6 || (months === 6 && days >= 1);
  const ageForCalculation = hasRoundingBenefit ? years + 1 : years;

  // Sugerencia de fecha para beneficio 6+1
  let benefitSuggestion = null;
  if (!hasRoundingBenefit && months >= 4) {
    const monthsToWait = 7 - months;
    const targetDate = new Date(today);
    targetDate.setMonth(targetDate.getMonth() + monthsToWait);
    targetDate.setDate(1); // El día 1 para asegurar el paso del umbral
    
    benefitSuggestion = {
      monthsRemaining: monthsToWait,
      targetDate: targetDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    };
  }

  // Porcentaje de pensión aproximado (60 años = 75%, +5% por año)
  const basePercentage = 75;
  const percentage = Math.max(0, basePercentage + (ageForCalculation - 60) * 5);

  return {
    anios: years,
    meses: months,
    dias: days,
    ageForCalculation,
    percentage: Math.min(100, percentage),
    hasRoundingBenefit,
    benefitSuggestion
  };
}

/**
 * Comparación Inteligente de Nombres (Fix de OCR)
 * Algoritmo: Mayúsculas, eliminar acentos, romper en palabras, ordenar alfabéticamente, comparar unidas.
 */
export function smartNameCompare(s1: string, s2: string): boolean {
  const process = (s: string) => 
    (s || '')
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .toUpperCase()
      .trim()
      .split(/\s+/) // Dividir en palabras
      .filter(p => p.length > 0)
      .sort() // Ordenar alfabéticamente
      .join(""); // Unir
  
  return process(s1) === process(s2);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

/**
 * Comparación normalizada para detectar discrepancias leves (acentos, mayúsculas, espacios extra)
 */
export function normalizedCompare(s1: string, s2: string): boolean {
  const normalize = (s: string) => 
    (s || '')
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase()
      .trim();
  
  return normalize(s1) === normalize(s2);
}

export function getMesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
