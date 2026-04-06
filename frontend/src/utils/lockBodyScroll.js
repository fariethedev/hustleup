export function lockBodyScroll() {
  const originalStyle = window.getComputedStyle(document.body).overflow;
  const originalPadding = document.body.style.paddingRight;
  
  // Calculate scrollbar width to prevent "jumping" when scrollbar disappears
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

  document.body.style.overflow = 'hidden';
  
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  return () => {
    document.body.style.overflow = originalStyle === 'hidden' ? '' : originalStyle;
    document.body.style.paddingRight = originalPadding;
  };
}
