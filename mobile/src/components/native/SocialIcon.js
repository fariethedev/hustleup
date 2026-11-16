import React from 'react';
import { BookmarkCheck, Check, CircleCheck, CircleX, Clapperboard, Drama, Eye, Flame, Images, IterationCw, Layers, Link2, MessageCircleMore, MoveLeft, Phone, Play, Plus, ScanSearch, SendHorizontal, Share, ShieldCheck, Square, SquareCheck, SquarePen, UserCog, UserRound, Users, Video, Volume2, VolumeX, WandSparkles } from 'lucide-react-native';

// Same Lucide glyphs as the website; legacy names keep existing actions intact.
const icons = {
  bookmark: BookmarkCheck, check: Check, 'check-circle': CircleCheck,
  x: CircleX, video: Clapperboard, 'eye-off': Drama, eye: Eye,
  heart: Flame, 'heart-outline': Flame, image: Images, repeat: IterationCw,
  'layers-outline': Layers, link: Link2, 'comment-outline': MessageCircleMore,
  'message-circle': MessageCircleMore, 'arrow-left': MoveLeft, 'chevron-left': MoveLeft,
  phone: Phone, play: Play, plus: Plus, search: ScanSearch, send: SendHorizontal,
  share: Share, 'check-decagram': ShieldCheck, square: Square, 'check-square': SquareCheck,
  edit: SquarePen, 'edit-3': SquarePen, 'user-x': Drama, users: Users,
  'volume-off': VolumeX, 'volume-high': Volume2, following: UserRound,
  communities: UserCog, fyp: WandSparkles, saved: BookmarkCheck, 'video-call': Video,
};

export default function SocialIcon({ name, size = 24, color, ...props }) {
  const Icon = icons[name];
  return Icon ? <Icon size={size} color={color} strokeWidth={2} {...props} /> : null;
}
