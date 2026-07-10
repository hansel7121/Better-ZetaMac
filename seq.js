// Flow Traders OA — Sequences test. A 26-question, 25-minute multiple-choice
// number/letter-sequence assessment modelled on Flow Traders' pattern sheets.
// Unlike the mental-math test, the candidate can navigate back and forth,
// change answers, and skip. Self-contained: its own localStorage history,
// no shared state with the math test or the zetamac game.
(function () {
    'use strict';

    var TOTAL = 26;
    var DURATION = 1500; // 25 minutes
    var SEQ_KEY = 'seq_history';
    var LETTERS = ['A', 'B', 'C', 'D', 'E'];

    // --- helpers ----------------------------------------------------------
    function rnd(n) { return Math.floor(Math.random() * n); }
    function randInt(min, max) { return min + rnd(max - min + 1); }
    function pick(arr) { return arr[rnd(arr.length)]; }
    function shuffle(a) {
        for (var i = a.length - 1; i > 0; i--) {
            var k = rnd(i + 1); var t = a[i]; a[i] = a[k]; a[k] = t;
        }
        return a;
    }
    function toLetter(n) { return String.fromCharCode(64 + n); } // 1 -> A

    // --- choice builders --------------------------------------------------
    // Numeric: `hints` are rule-based traps (wrong operation, off-by-one rule),
    // padded with near-misses until we have four distinct distractors.
    function numChoices(correct, hints) {
        var seen = {}; seen[String(correct)] = true;
        var wrong = [];
        function add(v) {
            if (!isFinite(v)) return;
            v = Math.round(v);
            var s = String(v);
            if (seen[s]) return;
            seen[s] = true;
            wrong.push(v);
        }
        (hints || []).forEach(add);
        shuffle([1, -1, 2, -2, 3, -3, 5, -5, 10, -10]).forEach(function (d) { add(correct + d); });
        var opts = wrong.slice(0, 4).concat([correct]);
        shuffle(opts);
        return { options: opts.map(String), correctIndex: opts.indexOf(correct) };
    }

    // Letter: work in 1..26 position space, then map to letters.
    function letterChoices(correctPos) {
        var seen = {}; seen[correctPos] = true;
        var wrong = [];
        function add(v) {
            if (v < 1 || v > 26 || seen[v]) return;
            seen[v] = true; wrong.push(v);
        }
        shuffle([1, -1, 2, -2, 3, -3, 4, -4]).forEach(function (d) { add(correctPos + d); });
        var opts = wrong.slice(0, 4).concat([correctPos]);
        shuffle(opts);
        return { options: opts.map(toLetter), correctIndex: opts.indexOf(correctPos) };
    }

    // --- sequence generators ---------------------------------------------
    // Each returns { terms:[...], answer, hints, letter? } or null to retry.

    // Arithmetic: constant difference.
    function gArith() {
        var d = pick([2, 3, 4, 5, 6, 7, 9, 11, -3, -4, -5, 12, 15]);
        var s = randInt(-5, 20);
        var n = pick([4, 5]);
        var terms = [];
        for (var i = 0; i < n; i++) terms.push(s + i * d);
        var ans = s + n * d;
        return { terms: terms, answer: ans, hints: [ans - d, ans + d, s + n * (d + (d > 0 ? 1 : -1)), ans + 2] };
    }

    // Geometric: constant ratio.
    function gGeo() {
        var r = pick([2, 2, 2, 3, 3, 4]);
        var s = pick([1, 2, 3, 4, 5, 6]);
        var n = pick([4, 4, 5]);
        var terms = [], v = s;
        for (var i = 0; i < n; i++) { terms.push(v); v *= r; }
        var ans = v;
        if (ans > 200000) return null;
        var last = terms[n - 1], prev = terms[n - 2];
        return { terms: terms, answer: ans, hints: [last + (last - prev), ans + last, ans - last, last * (r + 1)] };
    }

    // Fibonacci-style: each term is the sum of the previous two.
    function gFib() {
        var a = randInt(1, 6), b = randInt(1, 8);
        var n = pick([5, 6]);
        var terms = [a, b];
        for (var i = 2; i < n; i++) terms.push(terms[i - 1] + terms[i - 2]);
        var ans = terms[n - 1] + terms[n - 2];
        return { terms: terms, answer: ans, hints: [terms[n - 1] + terms[n - 3], 2 * terms[n - 1], ans - 1, ans + terms[n - 2] - terms[n - 3]] };
    }

    // Second-order differences: the differences form an arithmetic sequence.
    function gSecond() {
        var s = randInt(1, 12), d0 = randInt(1, 5), dd = pick([1, 2, 3, -1]);
        var n = pick([5, 6]);
        var terms = [s], diff = d0;
        for (var i = 1; i < n; i++) { terms.push(terms[i - 1] + diff); diff += dd; }
        var ans = terms[n - 1] + diff;      // diff is now the next first-difference
        var lastdiff = diff - dd;           // difference that produced the final shown term
        return { terms: terms, answer: ans, hints: [terms[n - 1] + lastdiff, terms[n - 1] + diff + dd, ans + 1, ans - 2] };
    }

    // Alternating / interleaved: two arithmetic sequences woven together.
    function gInterleave() {
        var aA = randInt(1, 9), dA = pick([1, 2, 3, 4]);
        var aB = randInt(10, 22), dB = pick([-1, -2, -3, 1, 2]);
        var terms = [];
        for (var i = 0; i < 3; i++) { terms.push(aA + i * dA); terms.push(aB + i * dB); }
        var ans = aA + 3 * dA;              // next belongs to sequence A
        return { terms: terms, answer: ans, hints: [aB + 3 * dB, ans - dA, ans + dA, aB + 2 * dB] };
    }

    // Multiplicative + additive combo: alternate ×m and +a (e.g. ×2 then −3).
    function gCombo() {
        var m = pick([2, 3]);
        var a = pick([1, 2, 3, 4, 5]) * pick([-1, 1]);
        var s = randInt(2, 9);
        var n = pick([5, 6]);
        var terms = [s], v = s, mulNext = true;
        for (var i = 1; i < n; i++) { v = mulNext ? v * m : v + a; mulNext = !mulNext; terms.push(v); }
        var ans = mulNext ? v * m : v + a;
        if (!isFinite(ans) || Math.abs(ans) > 200000) return null;
        return { terms: terms, answer: ans, hints: [mulNext ? v + a : v * m, ans + 1, ans - 1, ans + (mulNext ? a : m)] };
    }

    // Power sequences: consecutive squares, cubes, or triangular numbers.
    function gPower() {
        var mode = rnd(3), n = pick([4, 5]), s = randInt(1, 4);
        var terms = [], ans, hints, k;
        if (mode === 0) {            // squares
            for (var i = 0; i < n; i++) { k = s + i; terms.push(k * k); }
            k = s + n; ans = k * k;
        } else if (mode === 1) {     // cubes
            for (var j = 0; j < n; j++) { k = s + j; terms.push(k * k * k); }
            k = s + n; ans = k * k * k;
            if (ans > 200000) return null;
        } else {                     // triangular numbers
            for (var t = 0; t < n; t++) { k = s + t; terms.push(k * (k + 1) / 2); }
            k = s + n; ans = k * (k + 1) / 2;
        }
        var last = terms[n - 1], prev = terms[n - 2];
        hints = [last + (last - prev), ans + 1, ans - 1, last + (last - prev) + 1];
        return { terms: terms, answer: ans, hints: hints };
    }

    // Letter sequences: a numeric rule on alphabet positions.
    function gLetters() {
        var positions = [], p, g, n = pick([4, 5]);
        if (rnd(2)) {                // increasing gaps (second-order)
            p = randInt(1, 4); g = randInt(1, 3);
            for (var i = 0; i < n; i++) { positions.push(p); p += g; g += 1; }
        } else {                     // constant gap (arithmetic)
            p = randInt(1, 6); g = pick([2, 3, 4, 5]);
            for (var j = 0; j < n; j++) { positions.push(p); p += g; }
        }
        var ansPos = p;
        if (ansPos > 26) return null;
        var ch = letterChoices(ansPos);
        return { terms: positions.map(toLetter), answer: toLetter(ansPos), letter: true, _choices: ch };
    }

    var GENS = [gArith, gArith, gGeo, gGeo, gFib, gSecond, gSecond, gInterleave, gCombo, gCombo, gPower, gLetters, gLetters];

    function buildTest() {
        var qs = [], seen = {}, guard = 0;
        while (qs.length < TOTAL && guard < TOTAL * 200) {
            guard++;
            var g = pick(GENS)();
            if (!g) continue;
            var text = g.terms.join(', ') + ', ?';
            if (seen[text]) continue;
            var ch = g.letter ? g._choices : numChoices(g.answer, g.hints);
            if (!ch || ch.correctIndex < 0) continue;
            seen[text] = true;
            qs.push({ text: text, options: ch.options, correctIndex: ch.correctIndex });
        }
        return qs;
    }

    // --- history ----------------------------------------------------------
    function loadSeqHistory() {
        try { return JSON.parse(localStorage.getItem(SEQ_KEY) || '[]'); }
        catch (e) { return []; }
    }
    function saveSeqResult(r) {
        var h = loadSeqHistory();
        h.push({ ts: Date.now(), score: r.score, correct: r.correct, wrong: r.wrong, blank: r.blank });
        localStorage.setItem(SEQ_KEY, JSON.stringify(h));
    }
    function renderSeqScores() {
        var h = loadSeqHistory();
        if (!h.length) { $('#seq-scores').text('No attempts yet.'); return; }
        var last = h[h.length - 1].score;
        var best = h.reduce(function (m, e) { return Math.max(m, e.score); }, -Infinity);
        $('#seq-scores').html('Last score: <strong>' + last + '</strong> &middot; Best: <strong>' + best + '</strong> &middot; Attempts: ' + h.length);
    }

    // --- runtime ----------------------------------------------------------
    var test = null, index = 0, answers = null, startTime = 0, seqTimer = null;

    function fmtClock(sec) {
        sec = Math.max(0, sec);
        var m = Math.floor(sec / 60), s = sec % 60;
        return m + ':' + (s < 10 ? '0' + s : s);
    }

    function renderPalette() {
        var html = '';
        for (var i = 0; i < TOTAL; i++) {
            var cls = 'seq-pal';
            if (i === index) cls += ' current';
            else if (answers[i] !== null && answers[i] !== undefined) cls += ' answered';
            html += '<button type="button" class="' + cls + '" data-j="' + i + '">' + (i + 1) + '</button>';
        }
        $('#seq-palette').html(html);
    }

    function renderQuestion() {
        var q = test[index];
        $('#seq-progress').text('Question ' + (index + 1) + ' / ' + TOTAL);
        $('#seq-progressfill').css('width', ((index + 1) / TOTAL * 100) + '%');
        $('#seq-question').text(q.text);
        var sel = answers[index];
        var html = '';
        for (var i = 0; i < q.options.length; i++) {
            var c = 'flow-opt' + (sel === i ? ' selected' : '');
            html += '<button type="button" class="' + c + '" data-i="' + i + '">' +
                '<span class="flow-letter">' + LETTERS[i] + '</span>' +
                '<span class="flow-val">' + q.options[i] + '</span></button>';
        }
        $('#seq-options').html(html);
        $('#seq-prev').prop('disabled', index === 0);
        $('#seq-next').prop('disabled', index === TOTAL - 1);
        renderPalette();
    }

    function go(to) {
        if (to < 0 || to >= TOTAL) return;
        index = to;
        renderQuestion();
    }

    function choose(optionIndex) {
        // Toggle: re-selecting the current choice clears it (skip).
        answers[index] = (answers[index] === optionIndex) ? null : optionIndex;
        renderQuestion();
    }

    function tick() {
        var left = DURATION - Math.floor((Date.now() - startTime) / 1000);
        $('#seq-timer').text(fmtClock(left));
        if (left <= 0) finish();
    }

    function startTest() {
        test = buildTest();
        index = 0;
        answers = new Array(TOTAL).fill(null);
        $('#seq-intro').hide();
        $('#seq-results').hide();
        $('#seq-test').show();
        renderQuestion();
        startTime = Date.now();
        $('#seq-timer').text(fmtClock(DURATION));
        if (seqTimer) clearInterval(seqTimer);
        seqTimer = setInterval(tick, 250);
    }

    function finish() {
        if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
        var correct = 0, wrong = 0, blank = 0, rows = '';
        for (var i = 0; i < TOTAL; i++) {
            var q = test[i], a = answers[i], cls, your;
            if (a === null || a === undefined) {
                blank++; cls = 'flow-blank'; your = '<em>&mdash;</em>';
            } else if (a === q.correctIndex) {
                correct++; cls = 'flow-right'; your = LETTERS[a] + '. ' + q.options[a];
            } else {
                wrong++; cls = 'flow-wrong'; your = LETTERS[a] + '. ' + q.options[a];
            }
            rows += '<tr class="' + cls + '"><td>' + (i + 1) + '</td><td>' + q.text +
                '</td><td>' + your + '</td><td>' + LETTERS[q.correctIndex] + '. ' + q.options[q.correctIndex] + '</td></tr>';
        }
        var score = correct - wrong;
        saveSeqResult({ score: score, correct: correct, wrong: wrong, blank: blank });
        $('#seq-score-big').html('Score: <strong>' + score + '</strong> <small>/ ' + TOTAL + '</small>');
        $('#seq-breakdown').html(
            '<span class="flow-right">' + correct + ' correct (+' + correct + ')</span>' +
            '<span class="flow-wrong">' + wrong + ' incorrect (−' + wrong + ')</span>' +
            '<span class="flow-blank">' + blank + ' unanswered (0)</span>'
        );
        $('#seq-review tbody').html(rows);
        $('#seq-test').hide();
        $('#seq-results').show();
        window.scrollTo(0, 0);
    }

    function showSeqIntro() {
        if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
        $('#seq-test').hide();
        $('#seq-results').hide();
        $('#seq-intro').show();
        renderSeqScores();
    }

    // --- wiring -----------------------------------------------------------
    $(function () {
        $('#choose-seq').on('click', function () {
            $('#oa-choose').hide();
            $('#seq').show();
            showSeqIntro();
            window.scrollTo(0, 0);
        });
        $('#oa-back').on('click', function () {
            $('#oa-choose').hide();
            $('#welcome').show();
        });
        $('#seq-back, #seq-results-back').on('click', function () {
            if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
            $('#seq').hide();
            $('#welcome').show();
        });
        $('#seq-start, #seq-retake').on('click', startTest);
        $('#seq-options').on('click', '.flow-opt', function () {
            choose(parseInt($(this).attr('data-i'), 10));
        });
        $('#seq-prev').on('click', function () { go(index - 1); });
        $('#seq-next').on('click', function () { go(index + 1); });
        $('#seq-palette').on('click', '.seq-pal', function () {
            go(parseInt($(this).attr('data-j'), 10));
        });
        $('#seq-finish').on('click', function () {
            var blank = answers.filter(function (a) { return a === null || a === undefined; }).length;
            var msg = blank ? ('You have ' + blank + ' unanswered question' + (blank > 1 ? 's' : '') + '. Submit anyway?') : 'Submit your test?';
            if (window.confirm(msg)) finish();
        });
    });
})();
