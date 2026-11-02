(function () {
  async function send(id, payload) {
    const response = await GmDentalApiFetch('/api/appointments/' + encodeURIComponent(id) + '/manage', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not save appointment.');
    await window.GmDentalSupabaseSync?.pull?.({force:true});
    location.reload();
  }
  window.GMAppointmentActions = {
    reschedule(id) {
      const dialog = document.createElement('dialog'); dialog.className='gm-assist-dialog';
      dialog.innerHTML='<form><h2>Reschedule appointment</h2><p>The existing services and full appointment duration will be preserved.</p><label>New date<input type="date" name="date" required></label><label>New time<input type="time" name="time" required></label><label>Reason<textarea name="reason" required maxlength="300"></textarea></label><p role="alert"></p><button type="submit">Save reschedule</button><button type="button">Cancel</button></form>';
      document.body.append(dialog);dialog.showModal();
      dialog.addEventListener('close',()=>dialog.remove());
      dialog.querySelector('[type="button"]').onclick=()=>dialog.close();
      dialog.querySelector('form').onsubmit=async event=>{
        event.preventDefault();const button=dialog.querySelector('[type="submit"]');button.disabled=true;
        try {await send(id,{action:'reschedule',...Object.fromEntries(new FormData(event.target))});dialog.close();}
        catch(error){dialog.querySelector('[role="alert"]').textContent=error.message;button.disabled=false;}
      };
    },
    async archive(id) {
      if (!confirm('Archive this finished appointment? It will remain available as an archived record.')) return;
      try {await send(id,{action:'archive'});} catch(error){window.showToast?.(error.message,'error');}
    }
  };
})();
