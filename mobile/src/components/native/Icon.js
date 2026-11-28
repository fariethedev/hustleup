import React from 'react';
import * as Lucide from 'lucide-react-native';
import { Feather as FeatherGlyph } from '@expo/vector-icons';

/**
 * The app's icons, drawn from Lucide so they match hustlespace.space (the website uses
 * lucide-react). Call sites keep the familiar Feather API (`<Feather name="bell" />`):
 * Lucide grew out of Feather, so kebab-case names map straight onto its components. A
 * name Lucide does not have falls back to the old Feather glyph rather than vanishing.
 */
const RENAMED = { tool: 'Wrench' };
const pascal = name => name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');

export function Icon({ name, size = 20, color = '#000', strokeWidth = 2, style, ...rest }) {
  const Glyph = name ? Lucide[RENAMED[name] || pascal(name)] : null;
  if (!Glyph) return <FeatherGlyph name={name} size={size} color={color} style={style} {...rest} />;
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} style={style} {...rest} />;
}

export { Icon as Feather };
export default Icon;
