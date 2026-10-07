const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#nav');
function setMenu(open) {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.innerHTML = `${open ? 'Chiudi' : 'Menu'} <span aria-hidden="true">${open ? '−' : '+'}</span>`;
  nav.classList.toggle('open', open);
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', event => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    toggle.focus();
  }
});
window.matchMedia('(max-width: 760px)').addEventListener('change', () => setMenu(false));
const dialog = document.querySelector('#project-dialog');
const projectButton = document.querySelector('[data-project]');
projectButton.addEventListener('click', () => {
  dialog.showModal();
  document.body.classList.add('modal-open');
});
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  projectButton.focus();
});
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
document.querySelector('#copy-email').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText('mattia.manzi97@gmail.com');
    status.textContent = 'Email copiata.';
  } catch {
    status.textContent = 'Seleziona e copia l’indirizzo qui sopra.';
  }
});
