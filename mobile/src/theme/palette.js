export const palettes = {
  light: {
    bg: '#F5F6F3', card: '#FFFFFF', text: '#18181B', muted: '#52525B', line: '#E4E4E7',
    accent: '#7D39EB', onAccent: '#FFFFFF', purple: '#7D39EB', purpleSoft: '#F2EAFE',
    lime: '#CDFF00', onLime: '#151A00',
    soft: '#F0EEF4', danger: '#B42332', success: '#216840', light: true,
  },
  dark: {
    bg: '#0E0E10', card: '#1B1B1F', text: '#F5F5F7', muted: '#B4B4BC', line: '#34343A',
    accent: '#CDFF00', onAccent: '#152005', purple: '#B794F6', purpleSoft: '#30243E',
    lime: '#CDFF00', onLime: '#151A00',
    soft: '#26262C', danger: '#FF9CA6', success: '#93DBAC', light: false,
  },
};
export const themePreference = value => ['light', 'dark', 'system'].includes(value) ? value : 'light';
/**
 * Light is the default, matching hustlespace.space (#F5F6F3 page, white cards, violet accent).
 * People can switch to Dark or follow the phone from More > Appearance or Settings.
 */
export const resolveTheme = (preference, system) =>
  preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference === 'dark' ? 'dark' : 'light';
