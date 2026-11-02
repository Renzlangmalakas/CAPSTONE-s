(() => {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;
  const categories = new Map(Array.from(grid.querySelectorAll('.service-item')).map(item =>
    [window.GMServiceCatalog.key(item.querySelector('h5')?.textContent), item.dataset.category]));
  const status = document.createElement('p');
  status.className = 'text-center';
  status.setAttribute('role', 'status');
  grid.before(status);
  grid.replaceChildren();
  status.textContent = 'Loading current service prices…';
  let loading = false;
  let lastCatalog = '';
  let selectedService = null;
  let opener = null;
  let continueBooking = false;
  const popup = document.createElement('div');
  popup.className = 'modal fade service-details-modal'; popup.id = 'serviceDetailsModal';
  popup.tabIndex = -1; popup.setAttribute('aria-labelledby', 'servicePopupTitle');
  popup.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
    <div class="modal-header"><h2 class="modal-title" id="servicePopupTitle"></h2><button type="button" class="service-popup-close" data-bs-dismiss="modal" aria-label="Close service details">&times;</button></div>
    <div class="modal-body"><p id="servicePopupDescription"></p><p id="servicePopupDuration"></p><p class="service-popup-price" id="servicePopupPrice"></p></div>
    <div class="modal-footer"><button type="button" class="btn btn-gradient w-100" id="servicePopupBook">Book Appointment</button></div>
  </div></div>`;
  document.body.append(popup);
  const money = value => Number.isFinite(value) ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value) : 'Contact the clinic for pricing';
  const popupBook = popup.querySelector('#servicePopupBook');
  function populatePopup(service) {
    popup.querySelector('#servicePopupTitle').textContent = service.name;
    popup.querySelector('#servicePopupDescription').textContent = service.description || 'Contact the clinic for more information about this service.';
    popup.querySelector('#servicePopupDuration').textContent = service.displayDuration ? `Estimated duration: ${service.displayDuration}` : '';
    popup.querySelector('#servicePopupPrice').textContent = money(service.price);
    popupBook.disabled = false;
  }
  popupBook.addEventListener('click', () => {
    continueBooking = true;
    bootstrap.Modal.getInstance(popup).hide();
  });
  popup.addEventListener('hidden.bs.modal', () => {
    if (continueBooking) {
      continueBooking = false;
      bootstrap.Modal.getOrCreateInstance(document.getElementById('loginModal')).show();
    } else if (opener?.isConnected) opener.focus();
    selectedService = null;
  });
  async function refresh() {
    if (loading || document.hidden) return;
    loading = true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/services`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Prices unavailable');
      const { services } = await response.json();
      const catalog = JSON.stringify(services);
      if (catalog === lastCatalog) return;
      if (selectedService) {
        const latest = services.find(service => String(service.id || service.name) === selectedService);
        if (latest) populatePopup(latest);
        else { popupBook.disabled = true; popup.querySelector('#servicePopupPrice').textContent = 'This service is no longer available.'; }
      }
      const fragment = document.createDocumentFragment();
      for (const service of services) {
        const item = document.createElement('div');
        item.className = 'col-md-6 col-lg-4 service-item';
        item.dataset.category = categories.get(window.GMServiceCatalog.key(service.name)) || 'other';
        const card = document.createElement('div'); card.className = 'card service-card h-100';
        const body = document.createElement('div'); body.className = 'card-body d-flex flex-column text-center';
        const title = document.createElement('h5'); title.textContent = service.name;
        const desktopDetails = document.createElement('div'); desktopDetails.className = 'service-desktop-details';
        const description = document.createElement('p'); description.textContent = service.description || 'Contact the clinic for more information about this service.';
        desktopDetails.append(description);
        if (service.displayDuration) {
          const duration = document.createElement('p'); duration.textContent = `Estimated duration: ${service.displayDuration}`;
          desktopDetails.append(duration);
        }
        item.dataset.search = `${service.name} ${service.description || ''}`.toLowerCase();
        const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'service-details-toggle';
        toggle.dataset.service = String(service.id || service.name);
        toggle.setAttribute('aria-controls', popup.id);
        toggle.setAttribute('aria-haspopup', 'dialog');
        toggle.setAttribute('aria-label', `View details for ${service.name}`);
        toggle.addEventListener('click', () => {
          selectedService = String(service.id || service.name); opener = toggle;
          populatePopup(service);
          bootstrap.Modal.getOrCreateInstance(popup).show();
        });
        const price = document.createElement('p'); price.className = 'service-price mt-auto';
        price.textContent = Number.isFinite(service.price) ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(service.price) : 'Contact the clinic for pricing';
        const book = document.createElement('button'); book.type = 'button'; book.className = 'btn btn-gradient mt-2 w-100';
        book.textContent = 'Book Appointment'; book.dataset.bsToggle = 'modal'; book.dataset.bsTarget = '#loginModal';
        const photo = document.createElement('img'); photo.dataset.serviceImage = window.GMSiteContent.serviceImageKey(service); photo.alt = service.name; photo.hidden = true; photo.style.cssText = 'width:100%;height:150px;object-fit:cover;border-radius:12px;margin-bottom:12px';
        body.append(photo, title, desktopDetails, price, book); card.append(toggle, body); item.append(card); fragment.append(item);
      }
      grid.replaceChildren(fragment);
      window.GMRefreshServicePhotos?.();
      lastCatalog = catalog;
      serviceItems = grid.querySelectorAll('.service-item');
      filterServices();
      status.textContent = services.length ? '' : 'No services are currently available.';
    } catch {
      // Do not show stale or hardcoded prices as current after a failed refresh.
      grid.replaceChildren();
      lastCatalog = '';
      serviceItems = grid.querySelectorAll('.service-item');
      status.textContent = 'Current prices are unavailable. Retrying automatically…';
    } finally { loading = false; }
  }
  refresh();
  setInterval(refresh, 15000);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
})();
