function rand(n) {
    return Math.floor(Math.random() * n);
}

let currentOptions = null;
let gameTimer = null;

let scoreChart = null;

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

function saveScore(score, duration) {
    const history = loadHistory();
    history.push({ ts: Date.now(), score: score, duration: duration });
    localStorage.setItem('zetamac_history', JSON.stringify(history));
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
    game.find('.left').text('Seconds left:');
    game.find('span.correct').text('Score: 0');
    game.find('.banner .start').show();
    game.find('.banner .end').hide();
    game.find('.answer').val('').prop('disabled', false);
    game.find('.banner p.correct').text('Score: 0');

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
            saveScore(correct_ct, duration);
        }
    }, 1000);
}

$(function () {
    seedHistory();
    renderHistory();

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
    });

    $('#clear-history').on('click', function () {
        localStorage.removeItem('zetamac_history');
        renderHistory();
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
