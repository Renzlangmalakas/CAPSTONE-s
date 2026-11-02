(() => {
  function setup() {
    const modal = document.getElementById('serviceModal');
    let locked = false, savedY = 0, saved = [];
    const properties = ['position', 'top', 'left', 'right', 'width'];
    function update() {
      const open = modal?.classList.contains('active') || (innerWidth <= 1024 && document.body.classList.contains('sidebar-open'));
      if (open === locked) return;
      locked = open;
      document.documentElement.classList.toggle('patient-overlay-open', open);
      if (open) {
        savedY = scrollY;
        saved = properties.map(key => [key, document.body.style.getPropertyValue(key), document.body.style.getPropertyPriority(key)]);
        Object.entries({position:'fixed',top:`-${savedY}px`,left:'0',right:'0',width:'100%'}).forEach(([key,value])=>document.body.style.setProperty(key,value,'important'));
      } else {
        saved.forEach(([key,value,priority]) => value ? document.body.style.setProperty(key,value,priority) : document.body.style.removeProperty(key));
        const root = document.documentElement;
        const behavior = root.style.getPropertyValue('scroll-behavior');
        const priority = root.style.getPropertyPriority('scroll-behavior');
        root.style.setProperty('scroll-behavior','auto','important');
        window.scrollTo(0,savedY);
        if (behavior) root.style.setProperty('scroll-behavior',behavior,priority); else root.style.removeProperty('scroll-behavior');
      }
    }
    const observer = new MutationObserver(update);
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    if (modal) observer.observe(modal,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',update);
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',setup); else setup();
})();
