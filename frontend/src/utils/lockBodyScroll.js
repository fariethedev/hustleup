export function lockBodyScroll() {
  const scrollY = window.scrollY;
  const bodyStyle = document.body.style;

  bodyStyle.position = 'fixed';
  bodyStyle.top = `-${scrollY}px`;
  bodyStyle.left = '0';
  bodyStyle.right = '0';
  bodyStyle.width = '100%';
  bodyStyle.overflow = 'hidden';

  return () => {
    const top = bodyStyle.top;

    bodyStyle.position = '';
    bodyStyle.top = '';
    bodyStyle.left = '';
    bodyStyle.right = '';
    bodyStyle.width = '';
    bodyStyle.overflow = '';

    const offset = top ? Number.parseInt(top, 10) : 0;
    window.scrollTo(0, Number.isNaN(offset) ? scrollY : Math.abs(offset));
  };
}
