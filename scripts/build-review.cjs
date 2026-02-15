// Script to extract questions from App.jsx and build question-review.html
const fs = require('fs');

// Read App.jsx
const appContent = fs.readFileSync('src/App.jsx', 'utf8');

// Extract questionBank
const questionBankMatch = appContent.match(/const questionBank = \{[\s\S]*?\n\};/);
const questionBank = questionBankMatch ? questionBankMatch[0] : '';

// Extract examQuestions
const examQuestionsMatch = appContent.match(/const examQuestions = \{[\s\S]*?\n\};/);
const examQuestions = examQuestionsMatch ? examQuestionsMatch[0] : '';

// Extract descriptions
const descriptionsMatch = appContent.match(/const descriptions = \{[\s\S]*?\n\};/);
const descriptions = descriptionsMatch ? descriptionsMatch[0] : '';

// Build the HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Question Bank Review - Square One Maths</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0E0307;
      color: #EEEBF3;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      text-align: center;
      margin-bottom: 10px;
      color: #8B4CD4;
    }
    .stats {
      text-align: center;
      margin-bottom: 30px;
      color: #C0B4E3;
    }
    .filters {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .filters button {
      padding: 8px 16px;
      border: 1px solid #6E33B1;
      background: transparent;
      color: #C0B4E3;
      border-radius: 8px;
      cursor: pointer;
    }
    .filters button.active, .filters button:hover {
      background: #6E33B1;
      color: white;
    }
    .objective {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .objective h2 {
      color: #8B4CD4;
      margin-bottom: 5px;
      font-size: 1.2em;
    }
    .objective .description {
      color: #C0B4E3;
      font-size: 0.9em;
      margin-bottom: 15px;
    }
    .question {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 15px;
      margin-bottom: 10px;
    }
    .question-text {
      font-size: 1.1em;
      margin-bottom: 10px;
    }
    .meta {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      font-size: 0.85em;
    }
    .meta span {
      background: rgba(110, 51, 177, 0.3);
      padding: 4px 10px;
      border-radius: 6px;
    }
    .answer { color: #38E6A2; font-weight: bold; }
    .type { color: #67E8F9; }
    .calc-yes { color: #FBBF24; }
    .calc-no { color: #C0B4E3; }
    .options {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 10px 0;
    }
    .options span {
      background: rgba(255,255,255,0.1);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.9em;
    }
    .options span.correct {
      background: rgba(56, 230, 162, 0.3);
      border: 1px solid #38E6A2;
    }
    .hint {
      color: #FBBF24;
      font-style: italic;
      margin-top: 8px;
      font-size: 0.9em;
    }
    .exam-section {
      border-left: 3px solid #FBBF24;
      padding-left: 15px;
    }
    .exam-section h3 {
      color: #FBBF24;
      margin-bottom: 10px;
    }
    .marks {
      background: #FBBF24;
      color: #0E0307;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: bold;
    }
    .search {
      width: 100%;
      max-width: 400px;
      padding: 12px 16px;
      border: 1px solid #6E33B1;
      background: rgba(255,255,255,0.05);
      color: white;
      border-radius: 8px;
      margin: 0 auto 20px;
      display: block;
      font-size: 1em;
    }
    .search::placeholder { color: #C0B4E3; }
    .hidden { display: none !important; }
    .count-badge {
      background: #6E33B1;
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8em;
      margin-left: 8px;
    }
    .tier-higher {
      border-left: 3px solid #F472B6;
    }
    .tier-badge {
      background: #F472B6;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75em;
    }
  </style>
</head>
<body>
  <h1>📚 Question Bank Review</h1>
  <p class="stats" id="stats">Loading...</p>

  <input type="text" class="search" id="search" placeholder="Search questions...">

  <div class="filters" id="filters">
    <button class="active" data-filter="all">All</button>
    <button data-filter="mcq">MCQ</button>
    <button data-filter="number">Number</button>
    <button data-filter="text">Text</button>
    <button data-filter="order">Order</button>
    <button data-filter="match">Match</button>
    <button data-filter="exam">Exam Only</button>
  </div>

  <div id="content"></div>

  <script>
    ${questionBank}

    ${examQuestions}

    ${descriptions}

    // Render logic
    function renderQuestions() {
      const content = document.getElementById('content');
      let html = '';
      let totalQuestions = 0;
      let examCount = 0;

      const allObjectives = [...new Set([...Object.keys(questionBank), ...Object.keys(examQuestions)])].sort((a, b) => {
        const strandOrder = { N: 1, A: 2, R: 3, G: 4, P: 5, S: 6 };
        const strandA = a[0], strandB = b[0];
        if (strandA !== strandB) return strandOrder[strandA] - strandOrder[strandB];
        return parseInt(a.slice(1)) - parseInt(b.slice(1));
      });

      allObjectives.forEach(objId => {
        const questions = questionBank[objId] || [];
        const examQs = examQuestions[objId] || [];
        const desc = descriptions[objId] || '';

        if (questions.length === 0 && examQs.length === 0) return;

        totalQuestions += questions.length + examQs.length;
        examCount += examQs.length;

        html += '<div class="objective" data-objective="' + objId + '">';
        html += '<h2>' + objId + ' <span class="count-badge">' + questions.length + '</span></h2>';
        html += '<p class="description">' + desc + '</p>';

        questions.forEach((q, i) => {
          html += renderQuestion(q, i + 1, false);
        });

        if (examQs.length > 0) {
          html += '<div class="exam-section"><h3>📝 Exam Questions</h3>';
          examQs.forEach((q, i) => {
            html += renderQuestion(q, i + 1, true);
          });
          html += '</div>';
        }

        html += '</div>';
      });

      content.innerHTML = html;
      document.getElementById('stats').textContent =
        'Total: ' + totalQuestions + ' questions (' + (totalQuestions - examCount) + ' regular + ' + examCount + ' exam) across ' + allObjectives.length + ' objectives';
    }

    function renderQuestion(q, num, isExam) {
      let html = '<div class="question" data-type="' + q.type + '" data-exam="' + isExam + '">';
      html += '<p class="question-text">' + q.q + '</p>';

      if (q.type === 'mcq' && q.options) {
        html += '<div class="options">';
        q.options.forEach(opt => {
          const isCorrect = opt === q.a;
          html += '<span class="' + (isCorrect ? 'correct' : '') + '">' + opt + '</span>';
        });
        html += '</div>';
      }

      if (q.type === 'order' && q.correctOrder) {
        html += '<div class="options"><strong>Correct order:</strong> ' + q.correctOrder.join(' → ') + '</div>';
      }

      if (q.hint) {
        html += '<p class="hint">💡 ' + q.hint + '</p>';
      }

      html += '<div class="meta">';
      html += '<span class="answer">Answer: ' + q.a + '</span>';
      html += '<span class="type">' + q.type + '</span>';
      html += '<span class="' + (q.calculator ? 'calc-yes' : 'calc-no') + '">' + (q.calculator ? '🔢 Calc' : '✏️ Non-calc') + '</span>';
      if (q.marks) html += '<span class="marks">' + q.marks + ' marks</span>';
      if (q.tier === 'higher') html += '<span class="tier-badge">Higher</span>';
      html += '</div></div>';
      return html;
    }

    // Filter logic
    document.getElementById('filters').addEventListener('click', e => {
      if (e.target.tagName !== 'BUTTON') return;
      document.querySelectorAll('.filters button').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const filter = e.target.dataset.filter;

      document.querySelectorAll('.question').forEach(q => {
        if (filter === 'all') q.classList.remove('hidden');
        else if (filter === 'exam') q.classList.toggle('hidden', q.dataset.exam !== 'true');
        else q.classList.toggle('hidden', q.dataset.type !== filter);
      });
    });

    // Search logic
    document.getElementById('search').addEventListener('input', e => {
      const term = e.target.value.toLowerCase();
      document.querySelectorAll('.question').forEach(q => {
        q.classList.toggle('hidden', !q.textContent.toLowerCase().includes(term));
      });
    });

    renderQuestions();
  </script>
</body>
</html>`;

fs.writeFileSync('public/question-review.html', html);
console.log('✅ question-review.html rebuilt with ' + (questionBank.match(/\{ q:/g) || []).length + ' questions');
