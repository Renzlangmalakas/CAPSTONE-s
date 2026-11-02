function setupHistoryCalendar(input) {
  input.type = 'hidden';
  const wrap = document.createElement('div'); wrap.className = 'history-date-picker';
  input.after(wrap);
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'history-date-trigger'; trigger.setAttribute('aria-expanded','false'); trigger.setAttribute('aria-label', input.getAttribute('aria-label') || 'Choose date');
  const calendar = document.createElement('div'); calendar.className = 'history-calendar'; calendar.hidden = true;
  calendar.setAttribute('role','group'); calendar.setAttribute('aria-label','Choose history date');
  wrap.append(trigger,calendar);
  calendar.addEventListener('click', event => { event.preventDefault(); });
  calendar.setAttribute('popover', 'manual');
  let dismissEvents;
  function closeCalendar() {
    if (calendar.hidePopover && calendar.matches(':popover-open')) calendar.hidePopover();
    calendar.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    dismissEvents?.abort();
  }
  function openCalendar() {
    calendar.hidden = false;
    if (calendar.showPopover) calendar.showPopover();
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    calendar.style.width = width + 'px';
    calendar.style.maxHeight = Math.max(160, window.innerHeight - 24) + 'px';
    const height = calendar.getBoundingClientRect().height;
    const below = window.innerHeight - rect.bottom - 12;
    const top = below >= height ? rect.bottom + 6 : Math.max(12, rect.top - height - 6);
    calendar.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) + 'px';
    calendar.style.top = Math.min(top, window.innerHeight - height - 12) + 'px';
    trigger.setAttribute('aria-expanded', 'true');
    dismissEvents = new AbortController();
    const options = { signal: dismissEvents.signal };
    document.addEventListener('pointerdown', event => { if (!wrap.contains(event.target)) closeCalendar(); }, options);
    document.addEventListener('scroll', event => { if (!calendar.contains(event.target) && !calendar.contains(document.activeElement)) closeCalendar(); }, { ...options, capture: true });
    window.addEventListener('resize', closeCalendar, options);
  }
  let month = new Date();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const selected = () => /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? new Date(input.value+'T12:00:00') : new Date();
  function refresh() { trigger.textContent = input.value ? selected().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'Select date'; closeCalendar(); }
  function choose(day) { input.value=iso(day);input.dispatchEvent(new Event('change',{bubbles:true}));refresh();trigger.focus(); }
  function draw() {
    calendar.replaceChildren();
    const header=document.createElement('div');header.className='history-calendar-header';
    const prev=document.createElement('button'), next=document.createElement('button'),title=document.createElement('strong');
    prev.type=next.type='button';
    prev.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 6-6 6 6 6"/></svg>';
    next.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>';
    prev.setAttribute('aria-label','Previous month');next.setAttribute('aria-label','Next month');
    title.textContent=month.toLocaleDateString('en-GB',{month:'long',year:'numeric'});title.setAttribute('aria-live','polite');
    prev.onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);draw();calendar.querySelector('button').focus();};
    next.onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);draw();calendar.querySelectorAll('button')[1].focus();};
    header.append(prev,title,next);calendar.append(header);
    const grid=document.createElement('div');grid.className='history-calendar-grid';
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(day=>{const label=document.createElement('span');label.textContent=day;grid.append(label);});
    const start=new Date(month.getFullYear(),month.getMonth(),1).getDay();
    for(let i=0;i<start;i++)grid.append(document.createElement('span'));
    const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let day=1;day<=count;day++) {const date=new Date(month.getFullYear(),month.getMonth(),day);const button=document.createElement('button');button.type='button';button.textContent=day;button.setAttribute('aria-label',date.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}));button.setAttribute('aria-pressed',String(iso(date)===input.value));if(iso(date)===iso(new Date()))button.setAttribute('aria-current','date');button.onclick=()=>choose(date);grid.append(button);}
    calendar.append(grid);const today=document.createElement('button');today.type='button';today.className='history-calendar-today';today.textContent='Today';today.onclick=()=>choose(new Date());calendar.append(today);
  }
  trigger.onclick=()=>{if(!calendar.hidden){closeCalendar();return;}month=selected();month.setDate(1);draw();openCalendar();};
  input.addEventListener('change', refresh);
  wrap.addEventListener('keydown',event=>{if(event.key==='Escape'&&!calendar.hidden){event.preventDefault();event.stopPropagation();refresh();trigger.focus();}});
  refresh();return refresh;
}
