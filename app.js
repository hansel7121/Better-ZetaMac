function rand(n) {
    return Math.floor(Math.random() * n);
}

let currentOptions = null;
let gameTimer = null;

let scoreChart = null;
let speedChart = null;
let statsChart = null;
let drillRangeChart = null;
let drillOperandChart = null;
let drillAnswerChart = null;

function getOpType(problem) {
    if (problem.indexOf('+') !== -1) return 'add';
    if (problem.indexOf('*') !== -1) return 'mul';
    if (problem.indexOf('/') !== -1) return 'div';
    return 'sub';
}

function parseProblem(problem) {
    var sep = problem.indexOf(' + ') !== -1 ? ' + ' :
              problem.indexOf(' * ') !== -1 ? ' * ' :
              problem.indexOf(' / ') !== -1 ? ' / ' : ' - ';
    var parts = problem.split(sep);
    return { left: parseInt(parts[0], 10), right: parseInt(parts[1], 10) };
}

function makeHorizBar(canvasId, labels, data, color, onBarClick) {
    var options = {
        indexAxis: 'y',
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function (ctx) { return ' ' + ctx.parsed.x + 's avg'; },
                },
            },
        },
        scales: {
            x: { beginAtZero: true, title: { display: true, text: 'Avg seconds' } },
        },
    };
    if (onBarClick) {
        options.onClick = function (evt, elements) {
            if (!elements.length) return;
            onBarClick(elements[0].index);
        };
        options.onHover = function (evt, elements) {
            evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
        };
    }
    return new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: color,
                borderWidth: 0,
            }],
        },
        options: options,
    });
}

// Full options object matching the settings-form defaults, with every operation
// off. Targeted-practice sessions start from this and enable one operation.
function defaultOptions() {
    return {
        add: false, sub: false, mul: false, div: false,
        add_left_min: 2, add_left_max: 100, add_right_min: 2, add_right_max: 100,
        mul_left_min: 2, mul_left_max: 12, mul_right_min: 2, mul_right_max: 100,
        duration: 120,
        practice: true,
    };
}

// Build the game options for clicking the operand-value bar `label` for `opType`.
function operandPracticeTarget(opType, label) {
    var opts = defaultOptions();
    if (opType === 'mul') {
        var mv = parseInt(label.slice(1), 10); // strip leading '×'
        opts.mul = true;
        opts.mul_left_min = mv;
        opts.mul_left_max = mv;
        opts.practiceLabel = 'Multiplication · ' + label;
    } else if (opType === 'div') {
        var dv = parseInt(label.slice(1), 10); // strip leading '÷'
        opts.div = true;
        opts.mul_left_min = dv; // divisor = left factor of the reversed multiplication
        opts.mul_left_max = dv;
        opts.practiceLabel = 'Division · ' + label;
    } else {
        var parts = label.split('–'); // en-dash separated band, e.g. "11–20"
        var lo = parseInt(parts[0], 10);
        var hi = parseInt(parts[1], 10);
        if (opType === 'add') {
            opts.add = true;
            opts.add_left_min = lo;
            opts.add_left_max = hi;
            opts.practiceLabel = 'Addition · left operand ' + label;
        } else {
            // Subtraction is charted by minuend (first + second). Constrain the
            // operand ranges to the band ceiling and reject sums outside [lo, hi].
            opts.sub = true;
            opts.add_left_min = 2;
            opts.add_left_max = hi;
            opts.add_right_min = 2;
            opts.add_right_max = hi;
            opts.problemFilter = function (g) {
                var m = parseProblem(g.plainProblem).left;
                return m >= lo && m <= hi;
            };
            opts.practiceLabel = 'Subtraction · minuend ' + label;
        }
    }
    return opts;
}

function startPractice(target) {
    $('#welcome').hide();
    $('#game').show();
    initGame(target);
}

function closeDrillDown() {
    $('#drill-down').hide();
    if (drillRangeChart) { drillRangeChart.destroy(); drillRangeChart = null; }
    if (drillOperandChart) { drillOperandChart.destroy(); drillOperandChart = null; }
    if (drillAnswerChart) { drillAnswerChart.destroy(); drillAnswerChart = null; }
}

function showDrillDown(opType) {
    const opNames = { add: 'Addition', sub: 'Subtraction', mul: 'Multiplication', div: 'Division' };
    const history = loadHistory();
    const allProblems = [];

    history.forEach(function (game) {
        if (!game.problems) return;
        game.problems.forEach(function (p) {
            if (p.timeMs > 0 && getOpType(p.problem) === opType) {
                var parsed = parseProblem(p.problem);
                allProblems.push({ left: parsed.left, right: parsed.right, answer: p.answer, timeMs: p.timeMs });
            }
        });
    });

    if (!allProblems.length) return;

    // Destroy old charts, set title, show panel before creating charts so canvas dimensions are correct
    if (drillRangeChart) { drillRangeChart.destroy(); drillRangeChart = null; }
    if (drillOperandChart) { drillOperandChart.destroy(); drillOperandChart = null; }
    if (drillAnswerChart) { drillAnswerChart.destroy(); drillAnswerChart = null; }
    $('#drill-down-title').text(opNames[opType] + ' — Weakness Analysis');
    $('#drill-down').show();

    // 1. By number range
    var rangeBuckets, rangeFn;
    if (opType === 'mul') {
        rangeBuckets = ['\xd72–6', '\xd77–12'];
        rangeFn = function (p) { return p.left <= 6 ? rangeBuckets[0] : rangeBuckets[1]; };
    } else if (opType === 'div') {
        rangeBuckets = ['\xf72–6', '\xf77–12'];
        rangeFn = function (p) { return p.right <= 6 ? rangeBuckets[0] : rangeBuckets[1]; };
    } else {
        rangeBuckets = ['2–25', '26–50', '51–100'];
        rangeFn = function (p) {
            var m = Math.max(p.left, p.right);
            return m <= 25 ? rangeBuckets[0] : m <= 50 ? rangeBuckets[1] : rangeBuckets[2];
        };
    }
    var rangeGroups = {};
    rangeBuckets.forEach(function (b) { rangeGroups[b] = { sum: 0, count: 0 }; });
    allProblems.forEach(function (p) { var k = rangeFn(p); rangeGroups[k].sum += p.timeMs; rangeGroups[k].count++; });
    var rangeLabels = rangeBuckets.filter(function (b) { return rangeGroups[b].count > 0; });
    var rangeData = rangeLabels.map(function (b) { return Math.round(rangeGroups[b].sum / rangeGroups[b].count / 100) / 10; });
    drillRangeChart = makeHorizBar('drill-range-chart', rangeLabels, rangeData, 'rgba(54, 162, 235, 0.7)');

    // 2. By operand value
    var operandGroups = {}, operandOrder = [];
    if (opType === 'mul') {
        for (var v = 2; v <= 12; v++) { var mk = '\xd7' + v; operandGroups[mk] = { sum: 0, count: 0 }; operandOrder.push(mk); }
        allProblems.forEach(function (p) { var k = '\xd7' + p.left; if (operandGroups[k]) { operandGroups[k].sum += p.timeMs; operandGroups[k].count++; } });
    } else if (opType === 'div') {
        for (var v = 2; v <= 12; v++) { var dk = '\xf7' + v; operandGroups[dk] = { sum: 0, count: 0 }; operandOrder.push(dk); }
        allProblems.forEach(function (p) { var k = '\xf7' + p.right; if (operandGroups[k]) { operandGroups[k].sum += p.timeMs; operandGroups[k].count++; } });
    } else {
        var bands = ['2–10','11–20','21–30','31–40','41–50','51–60','61–70','71–80','81–90','91–100'];
        bands.forEach(function (b) { operandGroups[b] = { sum: 0, count: 0 }; operandOrder.push(b); });
        allProblems.forEach(function (p) {
            var l = p.left;
            var band = l <= 10 ? bands[0] : l <= 20 ? bands[1] : l <= 30 ? bands[2] : l <= 40 ? bands[3] :
                       l <= 50 ? bands[4] : l <= 60 ? bands[5] : l <= 70 ? bands[6] : l <= 80 ? bands[7] :
                       l <= 90 ? bands[8] : bands[9];
            operandGroups[band].sum += p.timeMs; operandGroups[band].count++;
        });
    }
    var operandLabels = operandOrder.filter(function (b) { return operandGroups[b].count > 0; });
    var operandData = operandLabels.map(function (b) { return Math.round(operandGroups[b].sum / operandGroups[b].count / 100) / 10; });
    var operandTargets = operandLabels.map(function (b) { return operandPracticeTarget(opType, b); });
    drillOperandChart = makeHorizBar('drill-operand-chart', operandLabels, operandData, 'rgba(255, 99, 132, 0.7)', function (index) {
        startPractice(operandTargets[index]);
    });

    // 3. By answer size
    var answerBuckets, answerFn;
    if (opType === 'add' || opType === 'sub') {
        answerBuckets = ['≤25', '26–75', '76–150', '>150'];
        answerFn = function (p) { var a = p.answer; return a <= 25 ? answerBuckets[0] : a <= 75 ? answerBuckets[1] : a <= 150 ? answerBuckets[2] : answerBuckets[3]; };
    } else {
        answerBuckets = ['≤50', '51–200', '201–500', '>500'];
        answerFn = function (p) { var a = p.answer; return a <= 50 ? answerBuckets[0] : a <= 200 ? answerBuckets[1] : a <= 500 ? answerBuckets[2] : answerBuckets[3]; };
    }
    var answerGroups = {};
    answerBuckets.forEach(function (b) { answerGroups[b] = { sum: 0, count: 0 }; });
    allProblems.forEach(function (p) { var k = answerFn(p); answerGroups[k].sum += p.timeMs; answerGroups[k].count++; });
    var answerLabels = answerBuckets.filter(function (b) { return answerGroups[b].count > 0; });
    var answerData = answerLabels.map(function (b) { return Math.round(answerGroups[b].sum / answerGroups[b].count / 100) / 10; });
    drillAnswerChart = makeHorizBar('drill-answer-chart', answerLabels, answerData, 'rgba(75, 192, 192, 0.7)');

    document.getElementById('drill-down').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem('zetamac_history') || '[]');
    } catch (e) {
        return [];
    }
}

function seedHistory() {
    if (localStorage.getItem('zetamac_seeded')) return;
    const averages = [55, 56, 57, 58, 60];
    const entries = [];
    averages.forEach(function (avg, i) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - (averages.length - i));
        entries.push({ ts: d.getTime(), score: avg, duration: 120 });
    });
    localStorage.setItem('zetamac_history', JSON.stringify(entries));
    localStorage.setItem('zetamac_seeded', '1');
}

function saveScore(score, duration, problems) {
    const history = loadHistory();
    history.push({
        ts: Date.now(),
        score: score,
        duration: duration,
        problems: problems
            .filter(function (p) { return p.timeMs > 0; })
            .map(function (p) { return { problem: p.problem, answer: p.answer, timeMs: p.timeMs }; }),
    });
    localStorage.setItem('zetamac_history', JSON.stringify(history));
}

function renderEndScreen(problems) {
    const completed = problems.filter(function (p) { return p.timeMs > 0; });

    if (speedChart) { speedChart.destroy(); speedChart = null; }
    speedChart = new Chart(document.getElementById('speed-chart'), {
        type: 'bar',
        data: {
            labels: completed.map(function (_, i) { return '#' + (i + 1); }),
            datasets: [{
                data: completed.map(function (p) { return Math.round(p.timeMs / 100) / 10; }),
                backgroundColor: 'rgba(0, 68, 204, 0.6)',
                borderColor: '#0044cc',
                borderWidth: 1,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Seconds' } },
                x: { title: { display: true, text: 'Question #' } },
            },
        },
    });

    const sorted = completed.slice().sort(function (a, b) { return b.timeMs - a.timeMs; });
    const tbody = $('#questions-table tbody');
    tbody.empty();
    sorted.forEach(function (p) {
        tbody.append(
            '<tr><td>' + p.problem + ' = ' + p.answer + '</td>' +
            '<td>' + (p.timeMs / 1000).toFixed(1) + 's</td></tr>'
        );
    });

    $('#end-details').show();
}

function renderStats() {
    const history = loadHistory();
    const totals = { add: 0, sub: 0, mul: 0, div: 0 };
    let hasData = false;

    history.forEach(function (game) {
        if (!game.problems) return;
        game.problems.forEach(function (p) {
            if (p.timeMs <= 0) return;
            totals[getOpType(p.problem)] += p.timeMs;
            hasData = true;
        });
    });

    if (!hasData) {
        $('#stats-empty').show();
        $('#stats-chart').hide();
        $('#stats-hint').hide();
        closeDrillDown();
        if (statsChart) { statsChart.destroy(); statsChart = null; }
        return;
    }

    $('#stats-empty').hide();
    $('#stats-chart').show();
    $('#stats-hint').show();

    const total = totals.add + totals.sub + totals.mul + totals.div;
    if (statsChart) { statsChart.destroy(); statsChart = null; }
    statsChart = new Chart(document.getElementById('stats-chart'), {
        type: 'pie',
        data: {
            labels: ['Addition', 'Subtraction', 'Multiplication', 'Division'],
            datasets: [{
                data: ['add', 'sub', 'mul', 'div'].map(function (k) {
                    return Math.round(totals[k] / total * 1000) / 10;
                }),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                ],
            }],
        },
        options: {
            responsive: true,
            onClick: function (evt, elements) {
                if (!elements.length) return;
                showDrillDown(['add', 'sub', 'mul', 'div'][elements[0].index]);
            },
            onHover: function (evt, elements) {
                evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function (ctx) { return ctx.label + ': ' + ctx.parsed + '%'; },
                    },
                },
            },
        },
    });
}

function renderHistory() {
    const history = loadHistory();

    if (history.length === 0) {
        $('#history-empty').show();
        $('#score-chart').hide();
        $('#clear-history').hide();
        if (scoreChart) { scoreChart.destroy(); scoreChart = null; }
        return;
    }

    $('#history-empty').hide();
    $('#score-chart').show();
    $('#clear-history').show();

    // Group by local date string and average scores
    const byDay = {};
    history.forEach(function (entry) {
        const day = new Date(entry.ts).toLocaleDateString();
        if (!byDay[day]) byDay[day] = { sum: 0, count: 0, ts: entry.ts };
        byDay[day].sum += entry.score;
        byDay[day].count += 1;
    });

    const sorted = Object.keys(byDay).sort(function (a, b) {
        return byDay[a].ts - byDay[b].ts;
    });

    const labels = sorted;
    const data = sorted.map(function (day) {
        return Math.round((byDay[day].sum / byDay[day].count) * 10) / 10;
    });

    if (scoreChart) scoreChart.destroy();

    scoreChart = new Chart(document.getElementById('score-chart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Avg Score',
                data: data,
                borderColor: '#0044cc',
                backgroundColor: 'rgba(0, 68, 204, 0.08)',
                pointBackgroundColor: '#0044cc',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.3,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (ctx) { return 'Avg: ' + ctx.parsed.y; }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: { stepSize: 1 },
                },
            },
        },
    });
}

function initGame(options) {
    currentOptions = options;

    const game = $('#game');
    if (options.practice) {
        $('#practice-banner')
            .text(options.practiceLabel + ' — targeted practice, not saved to history')
            .show();
    } else {
        $('#practice-banner').hide();
    }
    game.find('.left').text('Seconds left:');
    game.find('span.correct').text('Score: 0');
    game.find('.banner .start').show();
    game.find('.banner .end').hide();
    game.find('.answer').val('').prop('disabled', false);
    game.find('.banner p.correct').text('Score: 0');
    $('#end-details').hide();
    $('#questions-table tbody').empty();
    if (speedChart) { speedChart.destroy(); speedChart = null; }

    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }

    let problemStartTime;
    const d_left = game.find('.left');
    const correct = game.find('span.correct');
    const banner = game.find('.banner');
    const problem = game.find('.problem');
    const answer = game.find('.answer');
    answer.focus();

    function randGen(min, max) {
        return function () {
            return min + rand(max - min + 1);
        };
    }
    const genTypes = ['add_left', 'add_right', 'mul_left', 'mul_right'];
    const randGens = {};
    genTypes.forEach(function (type) {
        randGens[type] = randGen(options[type + '_min'], options[type + '_max']);
    });

    function pg_add() {
        const left = randGens[genTypes[0]]();
        const right = randGens[genTypes[1]]();
        return {
            prettyProblem: left + ' + ' + right,
            plainProblem: left + ' + ' + right,
            answer: left + right,
        };
    }
    function pg_sub() {
        const first = randGens[genTypes[0]]();
        const second = randGens[genTypes[1]]();
        const left = first + second;
        const right = first;
        return {
            prettyProblem: left + ' – ' + right,
            plainProblem: left + ' - ' + right,
            answer: left - right,
        };
    }
    function pg_mul() {
        const left = randGens[genTypes[2]]();
        const right = randGens[genTypes[3]]();
        return {
            prettyProblem: left + ' \xD7 ' + right,
            plainProblem: left + ' * ' + right,
            answer: left * right,
        };
    }
    function pg_div() {
        const first = randGens[genTypes[2]]();
        const second = randGens[genTypes[3]]();
        if (first !== 0) {
            const left = first * second;
            const right = first;
            return {
                prettyProblem: left + ' \xF7 ' + right,
                plainProblem: left + ' / ' + right,
                answer: left / right,
            };
        }
    }

    const pgs = [];
    if (options.add) pgs.push(pg_add);
    if (options.sub) pgs.push(pg_sub);
    if (options.mul) pgs.push(pg_mul);
    if (options.div) pgs.push(pg_div);

    function problemGen() {
        let genned;
        while (genned == null) {
            genned = pgs[rand(pgs.length)]();
            if (genned && options.problemFilter && !options.problemFilter(genned)) {
                genned = null;
            }
        }
        return genned;
    }

    let genned;
    let thisProblemLog;

    function problemGeng() {
        genned = problemGen();
        thisProblemLog = {
            problem: genned.plainProblem,
            answer: genned.answer,
            entry: [],
            timeMs: -1,
        };
        problem.text(genned.prettyProblem);
        answer.val('');
    }

    const startTime = (problemStartTime = Date.now());
    let correct_ct = 0;
    const problemLog = [];

    answer.off('input');
    answer.on('input', function (e) {
        const value = e.currentTarget.value;
        if (thisProblemLog.entry) {
            const lastEntry = thisProblemLog.entry[thisProblemLog.entry.length - 1] || '';
            if (
                value.length - lastEntry.length > 1 ||
                /[^-\d\s]/.test(value) ||
                lastEntry.length >= 2 + String(genned.answer).length
            ) {
                thisProblemLog.entry = null;
            } else {
                thisProblemLog.entry.push(value);
            }
        }
        if (value.trim() === String(genned.answer)) {
            const now = Date.now();
            thisProblemLog.timeMs = now - problemStartTime;
            problemLog.push(thisProblemLog);
            problemStartTime = now;
            problemGeng();
            correct.text('Score: ' + ++correct_ct);
        }
        return true;
    });

    problemGeng();
    const duration = options.duration || 120;
    d_left.text('Seconds left: ' + duration);

    gameTimer = setInterval(function () {
        const d = duration - Math.floor((Date.now() - startTime) / 1000);
        d_left.text('Seconds left: ' + d);
        if (d <= 0) {
            problemLog.push(thisProblemLog);
            answer.prop('disabled', true);
            clearInterval(gameTimer);
            gameTimer = null;
            banner.find('.start').hide();
            banner.find('p.correct').text('Score: ' + correct_ct);
            banner.find('.end').show();
            if (!options.practice) {
                saveScore(correct_ct, duration, problemLog);
            }
            renderEndScreen(problemLog);
        }
    }, 1000);
}

$(function () {
    seedHistory();
    renderHistory();
    renderStats();

    $('#settings-form').on('submit', function (e) {
        e.preventDefault();
        const form = $(this);
        const options = {
            add: form.find('[name="add"]').prop('checked'),
            sub: form.find('[name="sub"]').prop('checked'),
            mul: form.find('[name="mul"]').prop('checked'),
            div: form.find('[name="div"]').prop('checked'),
            add_left_min: parseInt(form.find('[name="add_left_min"]').val(), 10),
            add_left_max: parseInt(form.find('[name="add_left_max"]').val(), 10),
            add_right_min: parseInt(form.find('[name="add_right_min"]').val(), 10),
            add_right_max: parseInt(form.find('[name="add_right_max"]').val(), 10),
            mul_left_min: parseInt(form.find('[name="mul_left_min"]').val(), 10),
            mul_left_max: parseInt(form.find('[name="mul_left_max"]').val(), 10),
            mul_right_min: parseInt(form.find('[name="mul_right_min"]').val(), 10),
            mul_right_max: parseInt(form.find('[name="mul_right_max"]').val(), 10),
            duration: parseInt(form.find('[name="duration"]').val(), 10),
        };
        $('#welcome').hide();
        $('#game').show();
        initGame(options);
    });

    $('#try-again').on('click', function (e) {
        e.preventDefault();
        if (currentOptions) {
            initGame(currentOptions);
        }
    });

    $('#change-settings').on('click', function (e) {
        e.preventDefault();
        if (gameTimer) {
            clearInterval(gameTimer);
            gameTimer = null;
        }
        $('#game').hide();
        $('#welcome').show();
        renderHistory();
        renderStats();
    });

    $('#clear-history').on('click', function () {
        localStorage.removeItem('zetamac_history');
        closeDrillDown();
        renderHistory();
        renderStats();
    });

    $('#drill-close').on('click', function () {
        closeDrillDown();
    });

    $(document).on('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'r' && $('#game').is(':visible')) {
            e.preventDefault();
            if (currentOptions) {
                initGame(currentOptions);
            }
        }
    });
});
