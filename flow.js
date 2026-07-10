// Flow Traders OA — a 60-question, 6-minute multiple-choice mental-math test
// modelled on Flow Traders' assessment sheets. Self-contained: it does not
// touch the zetamac game state or its localStorage history.
(function () {
    'use strict';

    var TOTAL = 60;
    var DURATION = 360; // 6 minutes
    var FLOW_KEY = 'flow_history';

    // --- number helpers ---------------------------------------------------
    function rnd(n) { return Math.floor(Math.random() * n); }
    function randInt(min, max) { return min + rnd(max - min + 1); }
    function pick(arr) { return arr[rnd(arr.length)]; }
    function roundTo(x, dp) { var f = Math.pow(10, dp); return Math.round(x * f) / f; }

    // Format a number for display, stripping binary-float noise. Our ranges stay
    // well inside the integer-safe zone, so no scientific notation appears.
    function fmt(x) {
        var r = roundTo(x, 6);
        if (Object.is(r, -0)) r = 0;
        return String(r);
    }
    function decimals(x) {
        var s = fmt(x);
        var i = s.indexOf('.');
        return i === -1 ? 0 : s.length - i - 1;
    }

    // --- multiple-choice distractors -------------------------------------
    // Build four choices for `correct`. Distractors mirror the real test's
    // traps: order-of-magnitude shifts, digit transpositions and near-misses.
    function makeChoices(correct) {
        var dp = decimals(correct);
        var unit = dp === 0 ? 1 : Math.pow(10, -dp);
        var abs = Math.abs(correct);
        var cand = [];
        function push(v) { if (isFinite(v)) cand.push(v); }

        // order-of-magnitude shifts (the classic 24000 / 240000 / 2400000 trap)
        push(roundTo(correct * 10, 6));
        push(roundTo(correct / 10, 6));

        // relative perturbations, kept at the answer's precision
        push(roundTo(correct * 1.1, dp));
        push(roundTo(correct * 0.9, dp));
        push(roundTo(correct * 1.2, dp));
        push(roundTo(correct * 0.8, dp));

        // near-misses at the smallest decimal place
        push(roundTo(correct + unit, dp));
        push(roundTo(correct - unit, dp));
        push(roundTo(correct + 2 * unit, dp));
        push(roundTo(correct - 2 * unit, dp));

        // adjacent-digit transpositions for larger integers
        if (dp === 0 && abs >= 100) {
            var sign = correct < 0 ? -1 : 1;
            var digs = String(Math.round(abs)).split('');
            for (var i = 0; i < digs.length - 1; i++) {
                if (digs[i] !== digs[i + 1]) {
                    var d2 = digs.slice();
                    var t = d2[i]; d2[i] = d2[i + 1]; d2[i + 1] = t;
                    push(parseInt(d2.join(''), 10) * sign);
                }
            }
        }

        var correctS = fmt(correct);
        var seen = {};
        seen[correctS] = true;

        // shuffle candidates so repeat runs vary
        for (var j = cand.length - 1; j > 0; j--) {
            var k = rnd(j + 1);
            var tmp = cand[j]; cand[j] = cand[k]; cand[k] = tmp;
        }

        var wrong = [];
        cand.forEach(function (v) {
            var s = fmt(v);
            if (seen[s]) return;
            seen[s] = true;
            wrong.push(v);
        });

        // pad if we somehow came up short of three distractors
        var step = 3;
        while (wrong.length < 3 && step < 60) {
            var pv = roundTo(correct + step * unit, dp);
            var ps = fmt(pv);
            step++;
            if (seen[ps]) continue;
            seen[ps] = true;
            wrong.push(pv);
        }

        var opts = wrong.slice(0, 3).concat([correct]);
        for (var m = opts.length - 1; m > 0; m--) {
            var q = rnd(m + 1);
            var tt = opts[m]; opts[m] = opts[q]; opts[q] = tt;
        }
        return { options: opts.map(fmt), correctIndex: opts.indexOf(correct) };
    }

    // --- question generators ---------------------------------------------
    // Section 1: basic integer arithmetic
    function gAdd() {
        var mode = rnd(3), a, b;
        if (mode === 0) { a = randInt(11, 99); b = randInt(11, 99); }
        else if (mode === 1) { a = randInt(100, 399); b = randInt(11, 199); }
        else { a = randInt(23, 89); b = randInt(100, 199); }
        return { text: a + ' + ' + b, answer: a + b };
    }
    function gSub() {
        var mode = rnd(3), a, b;
        if (mode === 0) { a = randInt(20, 99); b = randInt(11, 99); }
        else if (mode === 1) { a = randInt(100, 399); b = randInt(50, 350); }
        else { a = randInt(100, 333); b = randInt(120, 360); } // often negative
        return { text: a + ' − ' + b, answer: a - b };
    }
    function gMul() {
        var mode = rnd(3), a, b;
        if (mode === 0) { a = randInt(6, 19); b = randInt(6, 19); }
        else if (mode === 1) { a = randInt(3, 12); b = pick([5, 11, 12, 15, 21]); }
        else { a = randInt(11, 29); b = randInt(3, 9); }
        return { text: a + ' × ' + b, answer: a * b };
    }
    function gDiv() {
        var divisor = randInt(3, 12);
        var q = randInt(4, 29);
        return { text: divisor * q + ' ÷ ' + divisor, answer: q };
    }

    // Section 2: decimal arithmetic
    function dMul() {
        var mode = rnd(4), a, b;
        if (mode === 0) { a = randInt(2, 95) / pick([10, 100]); b = randInt(2, 9) / pick([10, 100]); }
        else if (mode === 1) { b = pick([0.25, 0.5, 0.75, 0.125, 0.2, 0.05]); a = randInt(4, 96); }
        else if (mode === 2) { a = randInt(20, 99); b = pick([1.02, 1.03, 1.05, 1.1, 0.98, 0.95]); }
        else { a = randInt(11, 99) / 10; b = randInt(3, 25); }
        return { text: fmt(a) + ' × ' + fmt(b), answer: roundTo(a * b, 6) };
    }
    function dDiv() {
        var b = pick([0.4, 0.5, 0.2, 0.25, 0.8, 1.2, 1.5, 0.6, 0.05, 0.9, 0.7]);
        var q = randInt(6, 90) / pick([1, 1, 2, 4]);
        var a = roundTo(b * q, 6);
        return { text: fmt(a) + ' ÷ ' + fmt(b), answer: roundTo(a / b, 6) };
    }
    function dAddSub() {
        var mode = rnd(4), a, b;
        if (mode === 0) { a = randInt(1000, 9900) / 100; b = randInt(100, 3000) / 1000; return { text: fmt(a) + ' + ' + fmt(b), answer: roundTo(a + b, 6) }; }
        if (mode === 1) { a = randInt(1000, 9900) / 100; b = randInt(100, 2000) / 1000; return { text: fmt(a) + ' − ' + fmt(b), answer: roundTo(a - b, 6) }; }
        if (mode === 2) { a = randInt(200, 900) / 100; b = randInt(100, 4000) / 1000; return { text: '−' + fmt(a) + ' + ' + fmt(b), answer: roundTo(b - a, 6) }; }
        a = randInt(1000, 9999); b = randInt(1000, 9999);
        return rnd(2) ? { text: a + ' + ' + b, answer: a + b } : { text: a + ' − ' + b, answer: a - b };
    }

    // Section 3: large multiplication (and big add/sub)
    function bMulBig() { var a = randInt(105, 499), b = randInt(105, 295); return { text: a + ' × ' + b, answer: a * b }; }
    function bMul3x2() { var a = randInt(115, 985), b = randInt(21, 98); return { text: a + ' × ' + b, answer: a * b }; }
    function bRound() {
        var a, b;
        if (rnd(2)) { a = randInt(12, 99); b = randInt(2, 9) * pick([100, 1000]); }
        else { a = randInt(11, 19) * pick([10, 100]); b = randInt(3, 9) * pick([100, 1000]); }
        return { text: a + ' × ' + b, answer: a * b };
    }
    function bDecPct() { var a = randInt(101, 899) / 10; var b = pick([1.02, 1.03, 1.05, 1.07, 2.04, 1.5, 0.98]); return { text: fmt(a) + ' × ' + fmt(b), answer: roundTo(a * b, 6) }; }
    function bDecInt() { var a = randInt(101, 499) / 10; var b = randInt(21, 98); return { text: fmt(a) + ' × ' + b, answer: roundTo(a * b, 6) }; }
    function bSmallDec() { var b = pick([0.03, 0.14, 0.05, 0.02, 0.007, 0.325, 0.008]); var a = randInt(300, 9999); return { text: a + ' × ' + fmt(b), answer: roundTo(a * b, 6) }; }
    function bBigAdd() { var a = randInt(1050, 9999), b = randInt(1050, 9999); return rnd(2) ? { text: a + ' + ' + b, answer: a + b } : { text: a + ' − ' + b, answer: a - b }; }

    var basicGens = [gAdd, gSub, gMul, gDiv];
    var decGens = [dMul, dMul, dDiv, dAddSub];
    var bigGens = [bMulBig, bMul3x2, bRound, bDecPct, bDecInt, bSmallDec, bBigAdd];

    function buildTest() {
        var qs = [];
        var seen = {};
        function addFrom(gens, count) {
            var made = 0, guard = 0;
            while (made < count && guard < count * 60) {
                guard++;
                var g = pick(gens)();
                if (!g || !isFinite(g.answer) || seen[g.text]) continue;
                seen[g.text] = true;
                var c = makeChoices(g.answer);
                qs.push({ text: g.text, answer: fmt(g.answer), options: c.options, correctIndex: c.correctIndex });
                made++;
            }
        }
        addFrom(basicGens, 24);
        addFrom(decGens, 21);
        addFrom(bigGens, 15);
        return qs;
    }

    // --- history ----------------------------------------------------------
    function loadFlowHistory() {
        try { return JSON.parse(localStorage.getItem(FLOW_KEY) || '[]'); }
        catch (e) { return []; }
    }
    function saveFlowResult(r) {
        var h = loadFlowHistory();
        h.push({ ts: Date.now(), score: r.score, correct: r.correct, wrong: r.wrong, blank: r.blank });
        localStorage.setItem(FLOW_KEY, JSON.stringify(h));
    }
    function renderFlowScores() {
        var h = loadFlowHistory();
        if (!h.length) { $('#flow-scores').text('No attempts yet.'); return; }
        var last = h[h.length - 1].score;
        var best = h.reduce(function (m, e) { return Math.max(m, e.score); }, -Infinity);
        $('#flow-scores').html('Last score: <strong>' + last + '</strong> &middot; Best: <strong>' + best + '</strong> &middot; Attempts: ' + h.length);
    }

    // --- test runtime -----------------------------------------------------
    var test = null, index = 0, answers = null, startTime = 0, flowTimer = null, locked = false;

    function fmtClock(sec) {
        sec = Math.max(0, sec);
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return m + ':' + (s < 10 ? '0' + s : s);
    }

    function renderQuestion() {
        var q = test[index];
        $('#flow-progress').text('Question ' + (index + 1) + ' / ' + TOTAL);
        $('#flow-progressfill').css('width', (index / TOTAL * 100) + '%');
        $('#flow-question').text(q.text + ' =');
        var letters = ['A', 'B', 'C', 'D'];
        var html = '';
        for (var i = 0; i < q.options.length; i++) {
            html += '<button type="button" class="flow-opt" data-i="' + i + '">' +
                '<span class="flow-letter">' + letters[i] + '</span>' +
                '<span class="flow-val">' + q.options[i] + '</span></button>';
        }
        $('#flow-options').html(html);
        locked = false;
    }

    function choose(optionIndex) {
        if (locked) return;
        locked = true;
        answers[index] = optionIndex;
        index++;
        if (index >= TOTAL) { finish(); return; }
        renderQuestion();
    }

    function tick() {
        var left = DURATION - Math.floor((Date.now() - startTime) / 1000);
        $('#flow-timer').text(fmtClock(left));
        if (left <= 0) finish();
    }

    function startTest() {
        test = buildTest();
        index = 0;
        answers = new Array(TOTAL).fill(null);
        locked = false;
        $('#flow-intro').hide();
        $('#flow-results').hide();
        $('#flow-test').show();
        renderQuestion();
        startTime = Date.now();
        $('#flow-timer').text(fmtClock(DURATION));
        if (flowTimer) clearInterval(flowTimer);
        flowTimer = setInterval(tick, 250);
    }

    function finish() {
        if (flowTimer) { clearInterval(flowTimer); flowTimer = null; }
        var correct = 0, wrong = 0, blank = 0;
        var letters = ['A', 'B', 'C', 'D'];
        var rows = '';
        for (var i = 0; i < TOTAL; i++) {
            var q = test[i];
            var a = answers[i];
            var cls, your;
            if (a === null || a === undefined) {
                blank++; cls = 'flow-blank'; your = '<em>&mdash;</em>';
            } else if (a === q.correctIndex) {
                correct++; cls = 'flow-right'; your = letters[a] + '. ' + q.options[a];
            } else {
                wrong++; cls = 'flow-wrong'; your = letters[a] + '. ' + q.options[a];
            }
            rows += '<tr class="' + cls + '"><td>' + (i + 1) + '</td><td>' + q.text +
                '</td><td>' + your + '</td><td>' + letters[q.correctIndex] + '. ' + q.options[q.correctIndex] + '</td></tr>';
        }
        var score = correct - wrong;
        saveFlowResult({ score: score, correct: correct, wrong: wrong, blank: blank });

        $('#flow-score-big').html('Score: <strong>' + score + '</strong> <small>/ ' + TOTAL + '</small>');
        $('#flow-breakdown').html(
            '<span class="flow-right">' + correct + ' correct (+' + correct + ')</span>' +
            '<span class="flow-wrong">' + wrong + ' incorrect (−' + wrong + ')</span>' +
            '<span class="flow-blank">' + blank + ' unanswered (0)</span>'
        );
        $('#flow-review tbody').html(rows);
        $('#flow-test').hide();
        $('#flow-results').show();
        $('#flow')[0].scrollTop = 0;
        window.scrollTo(0, 0);
    }

    function showIntro() {
        if (flowTimer) { clearInterval(flowTimer); flowTimer = null; }
        $('#flow-test').hide();
        $('#flow-results').hide();
        $('#flow-intro').show();
        renderFlowScores();
    }

    // --- wiring -----------------------------------------------------------
    $(function () {
        $('#flow-open').on('click', function () {
            $('#welcome').hide();
            $('#oa-choose').show();
            window.scrollTo(0, 0);
        });
        $('#choose-math').on('click', function () {
            $('#oa-choose').hide();
            $('#flow').show();
            showIntro();
            window.scrollTo(0, 0);
        });
        $('#flow-back, #flow-results-back').on('click', function () {
            if (flowTimer) { clearInterval(flowTimer); flowTimer = null; }
            $('#flow').hide();
            $('#welcome').show();
        });
        $('#flow-start, #flow-retake').on('click', startTest);
        $('#flow-options').on('click', '.flow-opt', function () {
            choose(parseInt($(this).attr('data-i'), 10));
        });
    });
})();
