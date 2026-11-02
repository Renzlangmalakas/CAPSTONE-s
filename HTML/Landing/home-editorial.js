(() => {
  const grid = document.getElementById('homeServicesGrid');
  if (!grid) return;
  const status = document.getElementById('homeServicesStatus');
  let loading = false, previous = '';
  async function refresh() {
    if (loading || document.hidden) return;
    loading = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/services`, {cache:'no-store'});
      if (!response.ok) throw new Error('Services unavailable');
      const { services } = await response.json();
      const selected = services.slice(0, 4);
      const serialized = JSON.stringify(selected);
      if (serialized === previous) return;
      const fragment = document.createDocumentFragment();
      for (const service of selected) {
        const card = document.createElement('article'); card.className = 'editorial-service';
        const photo = document.createElement('img'); photo.alt = service.name; photo.loading = 'lazy';
        photo.dataset.serviceImage = GMSiteContent.serviceImageKey(service); photo.hidden = true;
        const title = document.createElement('h3'); title.textContent = service.name;
        const description = document.createElement('p'); description.textContent = service.description || 'Explore this treatment with your dental team.';
        const price = document.createElement('p'); price.className = 'editorial-price';
        price.textContent = Number.isFinite(service.price) ? new Intl.NumberFormat('en-PH', {style:'currency',currency:'PHP'}).format(service.price) : 'Contact us for pricing';
        const book = document.createElement('button'); book.type = 'button'; book.className = 'btn btn-gradient'; book.textContent = 'Book Appointment'; book.dataset.bsToggle = 'modal'; book.dataset.bsTarget = '#loginModal';
        const media = document.createElement('div'); media.className = 'editorial-service-media'; media.append(photo);
        card.append(media,title,description,price,book); fragment.append(card);
      }
      grid.replaceChildren(fragment); previous = serialized;
      window.GMRefreshServicePhotos?.();
      status.textContent = selected.length ? '' : 'Please contact the clinic for available treatments.';
    } catch { previous = ''; grid.replaceChildren(); status.textContent = 'Service details are temporarily unavailable. Please contact the clinic for assistance.'; }
    finally { loading = false; }
  }
  refresh(); setInterval(refresh,15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
