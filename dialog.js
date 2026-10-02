// In-app confirm / prompt / alert. The browser's own dialogs are unreliable in a Home Screen web app,
// so every question the app asks goes through these. Each returns a promise.
window.GymDialog = (() => {
  function open({ message, ok = 'OK', cancel = 'Cancel', danger = false, input = null }) {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'modal';
      wrap.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true">
          <p></p>
          ${input != null ? '<input class="name-input" autocomplete="off">' : ''}
          <div class="modal-btns">
            ${cancel ? '<button class="modal-cancel"></button>' : ''}
            <button class="modal-ok${danger ? ' danger' : ''}"></button>
          </div>
        </div>`;
      wrap.querySelector('p').textContent = message;
      wrap.querySelector('.modal-ok').textContent = ok;
      if (cancel) wrap.querySelector('.modal-cancel').textContent = cancel;
      const field = wrap.querySelector('input');
      if (field) field.placeholder = input;

      const done = value => {
        wrap.remove();
        resolve(value);
      };
      wrap.addEventListener('click', e => {
        if (e.target.closest('.modal-ok')) done(field ? field.value : true);
        else if (e.target.closest('.modal-cancel') || e.target === wrap) done(field ? null : false);
      });
      if (field) field.addEventListener('keydown', e => { if (e.key === 'Enter') done(field.value); });

      document.body.appendChild(wrap);
      (field || wrap.querySelector('.modal-ok')).focus();
    });
  }

  return {
    // Resolves true or false. `danger` colours the confirm button red for deletions.
    confirm: (message, ok, danger) => open({ message, ok: ok || 'OK', danger }),
    // Resolves the typed text, or null when cancelled.
    prompt: (message, placeholder) => open({ message, ok: 'Save', input: placeholder || '' }),
    alert: message => open({ message, cancel: '' }),
  };
})();
