import { reducedMotion } from './dom';

/** Things already on the first screen stay put; the rest come into focus as they arrive. */
export function setupReveal() {
  if (reducedMotion || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  for (const node of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    if (node.getBoundingClientRect().top <= innerHeight) continue;
    node.classList.add('pending');
    io.observe(node);
  }
}
