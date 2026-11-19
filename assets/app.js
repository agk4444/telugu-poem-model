(function () {
  var form = document.getElementById('poem-form');
  var input = document.getElementById('first-line');
  var btn = document.getElementById('generate-btn');
  var statusEl = document.getElementById('status');
  var errorEl = document.getElementById('error');
  var resultEl = document.getElementById('result');
  var poemEl = document.getElementById('poem');
  var meaningWrap = document.getElementById('meaning-wrap');
  var meaningEl = document.getElementById('meaning');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    resultEl.hidden = true;
  }

  function generate(firstLine) {
    // The model was trained on Telugu script only; Roman letters
    // ("Medi pandu") confuse it into garbled output. Ask for Telugu
    // script instead of letting it guess.
    if (!/[\u0C00-\u0C7F]/.test(firstLine)) {
      showError('Please type the first line in Telugu script — this model reads Telugu letters, not English ones.');
      return;
    }
    input.value = firstLine;
    errorEl.hidden = true;
    resultEl.hidden = true;
    statusEl.hidden = false;
    btn.disabled = true;
    btn.textContent = 'Composing…';
    fetch('ask.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_line: firstLine })
    })
      .then(function (resp) { return resp.json().then(function (data) { return { ok: resp.ok, data: data }; }); })
      .then(function (res) {
        statusEl.hidden = true;
        btn.disabled = false;
        btn.textContent = 'Generate';
        if (!res.ok || res.data.error) {
          showError((res.data && res.data.error) || 'Something went wrong. Please try again.');
          return;
        }
        poemEl.textContent = (res.data.poem || '').trim();
        if (res.data.meaning) {
          meaningEl.textContent = res.data.meaning.trim();
          meaningWrap.hidden = false;
        } else {
          meaningWrap.hidden = true;
        }
        resultEl.hidden = false;
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function () {
        statusEl.hidden = true;
        btn.disabled = false;
        btn.textContent = 'Generate';
        showError('Could not reach the poem service. Please try again in a moment.');
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var line = input.value.trim();
    if (!line) { input.focus(); return; }
    generate(line);
  });

  document.getElementById('chips').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-line]');
    if (b) { generate(b.getAttribute('data-line')); }
  });
})();
