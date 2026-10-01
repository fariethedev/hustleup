let locks = 0;
let originalStyle = '';
let originalPadding = '';

export function lockBodyScroll() {
  if (locks === 0) {
    originalStyle = document.body.style.overflow;
    originalPadding = document.body.style.paddingRight;
  
  // Calculate scrollbar width to prevent "jumping" when scrollbar disappears
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

  document.body.style.overflow = 'hidden';
  
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  }
  locks++;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    locks--;
    if (locks === 0) {
      document.body.style.overflow = originalStyle;
      document.body.style.paddingRight = originalPadding;
    }
  };
}
