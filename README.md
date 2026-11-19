# Telugu Poem Model — CPU service + front end

A small Telugu poetry model that finishes a poem from its first line, in
Vemana's style, running on an ordinary CPU. No GPU, no paid API, no
database.

## The model

[agk4444/telugu-poem-model](https://huggingface.co/agk4444/telugu-poem-model) —
Udgam Labs Vemana-Base (278M parameters) fine-tuned on 15,361 Telugu poems
(Vemana, Bhagavatam, Sumati, Dasu, and others). The GGUF export in this
repo is `telugu-poem-model-q8_0.gguf` (Q8_0, ~285 MB).

Honest result: on 40 held-out Vemana poems the model reproduced **0
verbatim** — it learned the *form* (four lines, the `విశ్వదాభిరామ
వినురవేమ!` refrain, a meaning section), not the content of poems it
never saw. Treat its output as new verse in the old form, not as
quotations. For exact quotes, use the
[Vemana RAG](https://vemana.socialnews.xyz), which retrieves the real text.

## What is in this repo

| File | What it does |
|---|---|
| `Dockerfile` | llama-server image: prebuilt llama.cpp b12547 + the GGUF from Hugging Face |
| `docker-compose.yml` | One service, `telugu-poem-model`, on `127.0.0.1:8798` |
| `index.html`, `assets/app.js`, `assets/style.css` | The front end: first line in, poem out |
| `ask.php` | PHP proxy: builds the cue, calls the local llama-server, returns the poem |

## How it works

The front end sends the first line to `ask.php`, which builds the cue the
model was trained on:

```
మొదటి పాదం: {first_line}
పూర్తి పద్యం:
```

and posts it to the local llama-server's raw `/completion` endpoint
(`temperature: 0, n_predict: 200`). The model completes the poem and
appends a meaning section, which `ask.php` splits out. Rate limit:
20 generations per IP per hour (file-based, fails open).

**Do not use llama-cli or any chat endpoint for this model.** It is a
base-style model: `llama-cli` wraps the prompt in a chat template and the
model degenerates, spamming `<|im_start|>`. (Verified: the official base
GGUF does the same under llama-cli, so it is the tool, not the weights.)
Raw completion only — `llama-completion` locally, `/completion` in the
service.

## Run it locally

```bash
docker compose up -d --build   # downloads llama.cpp + the GGUF, starts the server
php -S 127.0.0.1:8080          # serve the front end (from this directory)
```

Open http://127.0.0.1:8080, give a first line, and it composes a poem in
~10 seconds on 4 CPU threads. `curl http://127.0.0.1:8798/health` checks
the server is up.

## Deploy on the Plesk box

Same pattern as the embedding service (Docker container on port 8797;
this one uses **8798** so they never collide). The box has 24 cores and
187 GB RAM; the model needs ~400 MB of RAM and a few CPU threads, so it
is a rounding error — but keep it loopback-only and do not expose it to
heavy traffic, since the box also serves the live site.

1. Copy this repo to the box (e.g. `/root/telugu-poem-model`).
2. `docker compose up -d --build` — first run downloads ~285 MB of model
   plus the llama.cpp binaries. Check it with
   `curl http://127.0.0.1:8798/health`.
3. Create a Plesk subdomain (e.g. `poems.socialnews.xyz`) and copy
   `index.html`, `assets/`, and `ask.php` into its docroot. No build step,
   no database, no API key. `ask.php` needs PHP with curl.
4. Verify in a browser: try the Vemana first line
   `అన్న మిడుట కన్న నధిక దానంబుల` — it should return a four-line poem
   ending with `విశ్వదాభిరామ వినురవేమ!` plus a meaning.

## Links

- Model card + training details: https://huggingface.co/agk4444/telugu-poem-model
- GGUF file: https://huggingface.co/agk4444/telugu-poem-model/resolve/main/telugu-poem-model-q8_0.gguf
- Base model: https://huggingface.co/udgamlabs/Vemana-Base
- Vemana RAG (exact quotes): https://vemana.socialnews.xyz
