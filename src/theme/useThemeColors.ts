import { useAuth } from '../context/AuthContext';

export interface ThemeColors {
  highContrast: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  placeholder: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  danger: string;
  dangerBg: string;
  success: string;
  successBg: string;
  warning: string;
}

const STANDARD_COLORS: ThemeColors = {
  highContrast: false,
  bg: '#FBF9F5',
  surface: '#FFFFFF',
  surfaceAlt: '#FDFBF9',
  border: '#EFEAE2',
  borderStrong: '#E6DFD5',
  text: '#1E1E1E',
  textSecondary: '#756F68',
  textMuted: '#8A8175',
  placeholder: '#A8A199',
  accent: '#996515',
  accentBg: '#FFF9EE',
  accentBorder: '#EED8A1',
  accentText: '#FFFFFF',
  danger: '#D9534F',
  dangerBg: '#FBEAE5',
  success: '#4A7C59',
  successBg: '#EAF4EC',
  warning: '#D9822B',
};

const HIGH_CONTRAST_COLORS: ThemeColors = {
  highContrast: true,
  bg: '#000000',
  surface: '#0D0D0D',
  surfaceAlt: '#171717',
  border: '#FFFFFF',
  borderStrong: '#FFD700',
  text: '#FFFFFF',
  textSecondary: '#F2F2F2',
  textMuted: '#D9D9D9',
  placeholder: '#B3B3B3',
  accent: '#FFD700',
  accentBg: '#262000',
  accentBorder: '#FFD700',
  accentText: '#000000',
  danger: '#FF6B6B',
  dangerBg: '#2E0909',
  success: '#5CFF8D',
  successBg: '#072B12',
  warning: '#FFB84D',
};

export function useThemeColors(): ThemeColors {
  const { state } = useAuth();
  return state.config.highContrast ? HIGH_CONTRAST_COLORS : STANDARD_COLORS;
}
