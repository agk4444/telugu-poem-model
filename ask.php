<?php
/**
 * Telugu poem model — finish a poem from its first line.
 *
 * POST {"first_line": "..."} -> JSON {"poem": "...", "meaning": "..."|null}
 *
 * Pipeline (all on this box, no database, no OpenRouter):
 *   first line -> cue "మొదటి పాదం: {line}\nపూర్తి పద్యం:\n"
 *              -> llama-server on 127.0.0.1:8798 (/completion, raw prompt)
 *              -> the fine-tuned model completes the poem and appends
 *                 a meaning section ("అర్థం:"), split out here.
 *
 * The model is a base-style model, NOT a chat model. Use ONLY the raw
 * /completion endpoint with the prompt above. NEVER point this at a chat
 * endpoint and NEVER use llama-cli for it: llama-cli wraps the prompt in
 * a chat template and the model degenerates, spamming <|im_start|>.
 * (Verified Nov 19: the official base GGUF does the same under
 * llama-cli, so it is the tool, not the weights.)
 *
 * Rate limit: 20 generations per IP per hour, file-based, fails open
 * (same pattern as the Sanatana/Vemana sites).
 */

header('Content-Type: application/json; charset=utf-8');

define('COMPLETION_URL', 'http://127.0.0.1:8798/completion');
define('RATE_LIMIT_MAX', 20);      // generations per IP per hour
define('RATE_LIMIT_WINDOW', 3600); // seconds
define('MAX_LINE_CHARS', 200);

// A 200-token generation takes ~10s on 4 CPU threads; give the script
// room beyond the default 30s limit.
set_time_limit(120);

function fail($code, $msg)
{
    http_response_code($code);
    echo json_encode(array('error' => $msg));
    exit;
}

// ---- rate limit (per IP, file-based, fails open if the store is unusable) ----
function rate_limited($ip)
{
    $dir = __DIR__ . '/data';
    $file = $dir . '/ratelimit.json';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        return false;
    }
    $fp = @fopen($file, 'c+');
    if (!$fp) {
        return false;
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return false;
    }
    $raw = stream_get_contents($fp);
    $store = $raw ? json_decode($raw, true) : array();
    if (!is_array($store)) {
        $store = array();
    }
    $now = time();
    $key = md5($ip);
    $hits = isset($store[$key]) ? $store[$key] : array();
    $hits = array_values(array_filter($hits, function ($t) use ($now) {
        return ($now - $t) < RATE_LIMIT_WINDOW;
    }));
    if (count($hits) >= RATE_LIMIT_MAX) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return true;
    }
    $hits[] = $now;
    $store[$key] = $hits;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($store));
    flock($fp, LOCK_UN);
    fclose($fp);
    return false;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'POST only.');
}

$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
if (rate_limited($ip)) {
    fail(429, 'Too many poems from this address — please wait a while and try again.');
}

$body = json_decode(file_get_contents('php://input'), true);
$first_line = isset($body['first_line']) ? trim((string) $body['first_line']) : '';
if ($first_line === '') {
    fail(400, 'Give the first line of a poem first.');
}
if (mb_strlen($first_line, 'UTF-8') > MAX_LINE_CHARS) {
    fail(400, 'Please keep the first line under 200 characters.');
}

// Same cue format the model was trained and tested on.
$prompt = "మొదటి పాదం: {$first_line}\nపూర్తి పద్యం:\n";

// ---- raw completion from the local llama-server (no chat template) ----
if (!function_exists('curl_init')) {
    fail(500, 'PHP curl is not available on this server.');
}
$ch = curl_init(COMPLETION_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(array(
    'prompt' => $prompt,
    'temperature' => 0,
    'n_predict' => 200,
)));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
curl_setopt($ch, CURLOPT_TIMEOUT, 100);
$out = curl_exec($ch);
$err = curl_error($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($out === false) {
    fail(502, 'The poem service did not answer. Please try again in a moment. (' . $err . ')');
}
$data = json_decode($out, true);
if ($code >= 400 || !isset($data['content'])) {
    fail(502, 'The poem service did not answer. Please try again in a moment.');
}

$completion = trim((string) $data['content']);
if ($completion === '') {
    fail(502, 'The poem service returned an empty poem. Please try again.');
}

// The model appends a meaning section after "అర్థం:" — split it out so
// the page can show the poem and its meaning separately.
$poem = $completion;
$meaning = null;
$marker = 'అర్థం:';
$pos = mb_strpos($completion, $marker, 0, 'UTF-8');
if ($pos !== false) {
    $poem = trim(mb_substr($completion, 0, $pos, 'UTF-8'));
    $meaning = trim(mb_substr(
        $completion,
        $pos + mb_strlen($marker, 'UTF-8'),
        null,
        'UTF-8'
    ));
    if ($meaning === '') {
        $meaning = null;
    }
}

echo json_encode(array(
    'first_line' => $first_line,
    'poem' => $poem,
    'meaning' => $meaning,
));
