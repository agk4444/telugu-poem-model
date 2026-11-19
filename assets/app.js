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
  var previewEl = document.getElementById('roman-preview');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    resultEl.hidden = true;
  }

  function generate(firstLine) {
    var line = firstLine;
    // Roman letters are converted to Telugu script first ("Medi pandu"
    // -> మేడి పండు); the model only reads Telugu script. The converted
    // line is shown in the input, so the user sees what was sent.
    if (!/[\u0C00-\u0C7F]/.test(line) && /[A-Za-z]/.test(line) &&
        typeof transliterateRomanTelugu === 'function') {
      line = transliterateRomanTelugu(line);
    }
    if (!/[\u0C00-\u0C7F]/.test(line)) {
      showError('Please type the first line in Telugu script — this model reads Telugu letters, not English ones.');
      return;
    }
    input.value = line;
    previewEl.hidden = true;
    errorEl.hidden = true;
    resultEl.hidden = true;
    statusEl.hidden = false;
    btn.disabled = true;
    btn.textContent = 'Composing…';
    fetch('ask.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_line: line })
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

  // Live preview: as Roman letters are typed, show the Telugu they will
  // become, so a wrong conversion is visible before generating.
  input.addEventListener('input', function () {
    var v = input.value.trim();
    if (/[A-Za-z]/.test(v) && !/[\u0C00-\u0C7F]/.test(v) &&
        typeof transliterateRomanTelugu === 'function') {
      var converted = transliterateRomanTelugu(v);
      if (/[\u0C00-\u0C7F]/.test(converted) && converted !== v) {
        previewEl.textContent = converted;
        previewEl.hidden = false;
        return;
      }
    }
    previewEl.hidden = true;
  });

  document.getElementById('chips').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-line]');
    if (b) { generate(b.getAttribute('data-line')); }
  });
})();
