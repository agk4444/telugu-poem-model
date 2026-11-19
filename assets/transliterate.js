/**
 * Roman (Tanglish) -> Telugu script transliteration, client-side.
 *
 * The poem model was trained on Telugu script only, so a first line typed
 * in English letters ("Medi pandu") confuses it. This converts the Roman
 * line to Telugu script before it reaches the model, and the page shows
 * the conversion as a live preview so the user can see (and correct) it.
 *
 * How it works: tokenize the word into consonants and vowels (longest
 * match), then render syllables — a consonant followed by a vowel takes
 * that vowel's sign, a consonant followed by another consonant (or the end
 * of a word) takes a virama. Capitals follow ITRANS where they don't clash
 * with ordinary capitalisation: D/T/N/L are the retroflex letters, Sh is
 * the retroflex sibilant, M mid-word is anusvara.
 *
 * Three corpus-measured rules (15,361-poem training corpus, Nov 19, 2026):
 * - a nasal before a stop/sibilant/h becomes anusvara ("mandu" -> మందు,
 *   "garjinche" -> గర్జించె), except before glides ("kanya" -> కన్య) and
 *   except a doubled nasal ("anna" -> అన్న);
 * - 'n' becomes retroflex ణ after ష / ర ("prana" -> ప్రాణ, "aruna" -> అరుణ);
 * - word-final "du" is retroflex ("aadu" -> ఆడు, "chudu" -> చూడు).
 *
 * Honest limit: Roman Telugu has no standard spelling, and some pairs are
 * genuinely ambiguous — "pandu" is పండు but "mandu" is మందు, "kadu" is
 * కాదు but "aadu" is ఆడు, and no rule can tell them apart. The frequent
 * words are listed explicitly below; the preview is the safety net — if
 * the conversion looks wrong, type the line in Telugu instead.
 *
 * Works in the browser and under node (for tests).
 */
(function (root) {
  'use strict';

  var VIRAMA = '్';

  // roman -> Telugu consonant letter
  var CONSONANTS = {
    'ksh': 'క్ష', 'jn': 'జ్ఞ', 'gn': 'జ్ఞ',
    'kh': 'ఖ', 'gh': 'ఘ', 'chh': 'ఛ', 'ch': 'చ', 'jh': 'ఝ',
    'Th': 'థ', 'Dh': 'ధ', 'Sh': 'ష', 'sh': 'శ',
    'th': 'థ', 'dh': 'ధ', 'ph': 'ఫ', 'bh': 'భ',
    'k': 'క', 'g': 'గ', 'j': 'జ', 'T': 'ట', 'D': 'డ', 'N': 'ణ',
    't': 'త', 'd': 'ద', 'n': 'న', 'p': 'ప', 'b': 'బ', 'm': 'మ',
    'y': 'య', 'r': 'ర', 'l': 'ల', 'L': 'ళ', 'v': 'వ', 'w': 'వ',
    's': 'స', 'S': 'స', 'h': 'హ'
  };

  // roman -> [independent vowel, vowel sign] ('' = inherent 'a')
  var VOWELS = {
    'aa': ['ఆ', 'ా'], 'ii': ['ఈ', 'ీ'], 'ee': ['ఈ', 'ీ'],
    'uu': ['ఊ', 'ూ'], 'oo': ['ఊ', 'ూ'], 'ae': ['ఏ', 'ే'],
    'ai': ['ఐ', 'ై'], 'oa': ['ఓ', 'ో'], 'au': ['ఔ', 'ౌ'],
    'A': ['ఆ', 'ా'], 'I': ['ఈ', 'ీ'], 'U': ['ఊ', 'ూ'],
    'E': ['ఏ', 'ే'], 'O': ['ఓ', 'ో'],
    'a': ['అ', ''], 'i': ['ఇ', 'ి'], 'u': ['ఉ', 'ు'],
    'e': ['ఎ', 'ె'], 'o': ['ఒ', 'ొ']
  };

  // Consonants after which a nasal becomes anusvara (stops, sibilants, h).
  var ANUSVARA_NEXT = {
    'క': 1, 'ఖ': 1, 'గ': 1, 'ఘ': 1, 'చ': 1, 'ఛ': 1, 'జ': 1, 'ఝ': 1,
    'ట': 1, 'ఠ': 1, 'డ': 1, 'ఢ': 1, 'త': 1, 'థ': 1, 'ద': 1, 'ధ': 1,
    'ప': 1, 'ఫ': 1, 'బ': 1, 'భ': 1, 'స': 1, 'శ': 1, 'ష': 1, 'హ': 1
  };

  // Words the rules get wrong, because Roman spelling cannot tell the
  // pairs apart (ణ్డ vs ంద, retroflex vs dental, long vs short vowels).
  // Listed from the training corpus's frequent words.
  var WORD_OVERRIDES = {
    'medi': 'మేడి', 'miduta': 'మిడుట', 'pandu': 'పండు', 'pandaga': 'పండగ',
    'rendu': 'రెండు', 'gunde': 'గుండె', 'bandi': 'బండి',
    'danda': 'దండ', 'kanda': 'కండ', 'nindu': 'నిండు', 'gundu': 'గుండు',
    'kadu': 'కాదు', 'kaadu': 'కాదు', 'padu': 'పడు',
    'aata': 'ఆట', 'maata': 'మాట', 'paata': 'పాట',
    'kota': 'కోట', 'veta': 'వేట', 'chota': 'చోట',
    'vema': 'వేమ', 'vemana': 'వేమన', 'vinuravema': 'వినురవేమ',
    'chudu': 'చూడు', 'nedu': 'నేడు', 'kuda': 'కూడా',
    'ipudu': 'ఇప్పుడు', 'epudu': 'ఎప్పుడు',
    'prana': 'ప్రాణ', 'samsaram': 'సంసారం',
    'krishna': 'క్రిష్ణ', 'vishnu': 'విష్ణు',
    'vaddu': 'వద్దు', 'muddu': 'ముద్దు', 'sattu': 'సత్తు',
    'katti': 'కత్తి', 'patti': 'పత్తి', 'pedda': 'పెద్ద',
    'jnana': 'జ్ఞాన', 'gnana': 'జ్ఞాన',
    'sita': 'సీత', 'gita': 'గీత', 'neti': 'నేటి'
  };

  // Tokens sorted longest-first so 'chh' beats 'ch', 'aa' beats 'a'.
  var TOKENS = [];
  Object.keys(CONSONANTS).forEach(function (r) {
    TOKENS.push({ roman: r, type: 'c', value: CONSONANTS[r] });
  });
  Object.keys(VOWELS).forEach(function (r) {
    TOKENS.push({ roman: r, type: 'v', value: VOWELS[r] });
  });
  TOKENS.sort(function (a, b) { return b.roman.length - a.roman.length; });

  function tokenize(word) {
    var tokens = [];
    var i = 0;
    while (i < word.length) {
      var ch = word[i];

      // Anusvara / visarga: capital M / H mid-word. At a word start they
      // are just a capitalised consonant ('Medi' starts with మ, not ం).
      if (ch === 'M' || ch === 'H') {
        if (tokens.length === 0) {
          tokens.push({ type: 'c', roman: ch, value: ch === 'M' ? 'మ' : 'హ' });
        } else {
          tokens.push({ type: ch === 'M' ? 'anusvara' : 'visarga' });
        }
        i += 1;
        continue;
      }

      // Doubled t / d are the retroflex geminates (చెట్టు, గుడ్డు).
      var two = word.substr(i, 2);
      if (two === 'tt' || two === 'dd') {
        tokens.push({ type: 'c', roman: two, value: two === 'tt' ? 'ట్ట' : 'డ్డ' });
        i += 2;
        continue;
      }

      // 'nth' is anusvara + dental t (అంత, ఇంత, ఎంత) — plain 'th' is థ.
      if (word.substr(i, 3) === 'nth') {
        tokens.push({ type: 'c', roman: 'nth', value: 'ంత' });
        i += 3;
        continue;
      }

      var matched = null;
      for (var t = 0; t < TOKENS.length; t++) {
        var tok = TOKENS[t];
        if (word.substr(i, tok.roman.length) === tok.roman) {
          matched = tok;
          break;
        }
      }
      if (!matched) {
        // Not a Telugu sound (digit, punctuation, stray letter): end the
        // syllable and pass the character through unchanged.
        tokens.push({ type: 'other', ch: ch });
        i += 1;
        continue;
      }
      tokens.push({ type: matched.type, roman: matched.roman, value: matched.value });
      i += matched.roman.length;
    }

    // Word-final "du" is retroflex (ఆడు, చూడు, నేడు) — 'kadu'/'padu'
    // are in the overrides because they are the dental exceptions.
    // After a nasal it stays dental (మందు, విందు, ముందు), not retroflex.
    var n = tokens.length;
    if (n >= 2 && tokens[n - 1].type === 'v' && tokens[n - 1].roman === 'u' &&
        tokens[n - 2].type === 'c' && tokens[n - 2].roman === 'd' &&
        !(n >= 3 && tokens[n - 3].type === 'c' &&
          (tokens[n - 3].roman === 'n' || tokens[n - 3].roman === 'm'))) {
      tokens[n - 2].value = 'డ';
    }
    return tokens;
  }

  function renderTokens(tokens) {
    var out = '';
    var pending = null;      // consonant letter waiting for its vowel/virama
    var prevCons = null;     // last consonant letter, for the n -> ణ rule
    var lastVowelWasA = false;

    function flush(asVirama) {
      if (!pending) { return; }
      out += pending + (asVirama ? VIRAMA : '');
      pending = null;
    }

    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];

      if (tok.type === 'anusvara' || tok.type === 'visarga') {
        flush(true);
        out += (tok.type === 'anusvara' ? 'ం' : 'ః');
        lastVowelWasA = false;
        continue;
      }
      if (tok.type === 'other') {
        flush(true);
        out += tok.ch;
        lastVowelWasA = false;
        prevCons = null;
        continue;
      }

      if (tok.type === 'c') {
        var val = tok.value;
        // 'n' becomes retroflex ణ after ష / ర (ప్రాణ, అరుణ, వర్ణ).
        if (tok.roman === 'n' && (prevCons === 'ష' || prevCons === 'ర')) {
          val = 'ణ';
        }
        // Nasal before a stop/sibilant/h becomes anusvara — except before
        // glides (కన్య, అన్వయ) and except a doubled nasal (అన్న, అమ్మ).
        if ((val === 'న' || val === 'మ') && i + 1 < tokens.length) {
          var nxt = tokens[i + 1];
          if (nxt.type === 'c' && ANUSVARA_NEXT[nxt.value] && nxt.value !== val) {
            flush(true);
            out += 'ం';
            prevCons = null;
            continue;
          }
        }
        flush(true);
        pending = val;
        prevCons = val;
        continue;
      }

      // Vowel: sign on the pending consonant, or an independent vowel.
      if (pending) {
        out += pending + tok.value[1];
        pending = null;
      } else {
        out += tok.value[0];
      }
      lastVowelWasA = (tok.roman === 'a' || tok.roman === 'A');
    }

    // Word ends on a consonant: virama — except a final 'm' after 'a',
    // which is the anusvara in classical words (ధర్మం, సత్యం, పద్యం).
    if (pending) {
      if (pending === 'మ' && lastVowelWasA) {
        out += 'ం';
      } else {
        out += pending + VIRAMA;
      }
    }
    return out;
  }

  function transliterateWord(word) {
    var lower = word.toLowerCase();
    if (WORD_OVERRIDES.hasOwnProperty(lower)) {
      return WORD_OVERRIDES[lower];
    }
    return renderTokens(tokenize(word));
  }

  function transliterateRomanTelugu(text) {
    if (!text) { return ''; }
    // Convert each run of Latin letters; Telugu, digits, spaces and
    // punctuation pass through untouched.
    return text.replace(/[A-Za-z]+/g, function (word) {
      return transliterateWord(word);
    });
  }

  root.transliterateRomanTelugu = transliterateRomanTelugu;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = transliterateRomanTelugu;
  }
})(typeof window !== 'undefined' ? window : globalThis);
