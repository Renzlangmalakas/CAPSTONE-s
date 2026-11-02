(() => {
  const element = document.getElementById('serviceCarousel');
  if (!element || !window.bootstrap) return;
  const slides = [...element.querySelectorAll('.carousel-item')].sort((a, b) =>
    (a.querySelector('h5')?.textContent || '').trim().localeCompare((b.querySelector('h5')?.textContent || '').trim(), 'en', { sensitivity: 'base', numeric: true }));
  slides.forEach((slide, index) => { slide.classList.toggle('active', index === 0); slide.parentElement.append(slide); });
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const carousel = bootstrap.Carousel.getOrCreateInstance(element, {interval:false, ride:false, wrap:true, keyboard:true, touch:true});
  let paused = motion.matches, keyboardPaused = false, visible = true, timer;
  slides.forEach((slide,index) => { slide.setAttribute('role','group'); slide.setAttribute('aria-roledescription','slide'); slide.setAttribute('aria-label',`${index+1} of ${slides.length}: ${slide.querySelector('h5')?.textContent || ''}`); });
  function schedule() {
    clearTimeout(timer);
    if (!paused && !keyboardPaused && visible && !document.hidden && slides.length>1) timer=setTimeout(()=>carousel.next(),4200);
  }
  element.addEventListener('slide.bs.carousel',()=>clearTimeout(timer));
  element.addEventListener('slid.bs.carousel',schedule);
  element.addEventListener('focusin', event => { keyboardPaused = event.target.matches(':focus-visible'); schedule(); });
  element.addEventListener('focusout',()=>setTimeout(()=>{keyboardPaused = element.contains(document.activeElement) && document.activeElement.matches(':focus-visible');schedule();},0));
  document.addEventListener('visibilitychange',schedule);
  motion.addEventListener('change',()=>{paused=motion.matches;schedule()});
  if ('IntersectionObserver' in window) new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule()},{threshold:0.15}).observe(element);
  schedule();
})();
