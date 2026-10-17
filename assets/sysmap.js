// The system map is the index of the course, so the map should be able to say
// what each of its parts actually teaches. Hovering or focusing a part fills
// the panel beside it with that module: its one line, and the four things it
// covers. The summaries below are the course's own, one entry per module.
//
// Markup contract (index.html):
//   <figure class="sysmap" data-sysmap>
//     … links carrying data-mod="05" … (map boxes, model chips, rail entries)
//     <div data-sysmap-panel="01"> the server-rendered default </div>
//
// Every part is a plain link to its module, so with this file blocked the map
// still works: the panel simply stays on its default.
(function () {
  var map = document.querySelector('[data-sysmap]');
  var panel = map && map.querySelector('[data-sysmap-panel]');
  if (!panel) return;

  var MODULES = {
    '00': {
      label: 'The history',
      title: 'How we got here',
      quote: 'Almost none of the maths is new.',
      learn: [
        ['How old the maths is', 'Chain rule 1676. Bayes 1763. Gradient descent 1847. Centuries, not years.'],
        ['Why it took so long', 'The ideas arrived first. The compute and the data arrived much later.'],
        ['The two AI winters', 'What was promised, what shipped, and why the funding left twice.'],
        ['What actually changed', 'GPUs, the internet as a training set, and one architecture: 2017.']
      ]
    },
    '01': {
      label: 'The map',
      title: 'What is an AI system?',
      quote: 'The model generates. The system does.',
      learn: [
        ['One nesting map', 'AI, ML, deep learning, generative AI and LLMs, in their place.'],
        ['Model vs product', 'Same model, different products, different failures.'],
        ['Training vs inference', 'Why your chat doesn’t teach the model.'],
        ['The system map', 'Eight boxes you’ll use for the rest of the course.']
      ]
    },
    '02': {
      label: 'Inside the model',
      title: 'How a model sees the world',
      quote: 'Context is the model’s working reality.',
      learn: [
        ['Tokens', 'What the model actually reads, and why it explains odd behavior.'],
        ['Embeddings and attention', 'How each token’s meaning is shaped by everything around it.'],
        ['Context windows', 'A hard budget. Fitting inside it isn’t the same as being used well.'],
        ['Token cost', 'Why every token costs money and time, on every single call.']
      ]
    },
    '03': {
      label: 'Learning',
      title: 'How models learn',
      quote: 'Training changes the model. Inference uses it.',
      learn: [
        ['Pretraining', 'Next-token prediction at scale, and what it leaves in the parameters.'],
        ['Not a database', 'Why facts are compressed patterns, and what that means for recall.'],
        ['Post-training', 'How a text predictor becomes an assistant with trained behavior.'],
        ['Where change lives', 'Parameters, context, memory or state: what changes what, and for how long.']
      ]
    },
    '04': {
      label: 'Probability',
      title: 'Reasoning, sampling and hallucination',
      quote: 'Fluency is not the same as truth.',
      learn: [
        ['Token probabilities', 'Each step is a spread of likely next tokens, not a looked-up answer.'],
        ['Sampling and temperature', 'How one token gets picked, and why the same prompt can differ.'],
        ['Hallucination', 'Why fluent, confident text can still be false.'],
        ['Reasoning and verification', 'More thinking improves the odds. Checks decide what ships.']
      ]
    },
    '05': {
      label: 'Context',
      title: 'Context engineering',
      quote: 'Construct the world the model reasons inside.',
      learn: [
        ['Anatomy of a context', 'System, user, history, examples, retrieved data and tool results.'],
        ['Instructions vs data', 'Who wrote each part, and how far to trust it.'],
        ['Order and hygiene', 'A deliberate order, and removing what pollutes the window.'],
        ['Prompt injection', 'Why the prompt can’t fix it, and how systems defend in layers.']
      ]
    },
    '06': {
      label: 'Knowledge',
      title: 'Retrieval, memory and fine-tuning',
      quote: 'Information, state and behavior are different problems.',
      learn: [
        ['Three different problems', 'Information, state and behavior each need a different mechanism.'],
        ['Semantic search', 'Embeddings, vector similarity and chunking, without the math.'],
        ['RAG and grounding', 'Find the right text, then answer from it, with sources.'],
        ['Memory and fine-tuning', 'Where state should live, and when to change the model itself.']
      ]
    },
    '07': {
      label: 'Tools',
      title: 'How models interact with the real world',
      quote: 'The model requests. Another system acts.',
      learn: [
        ['The tool loop', 'Describe, request, execute, return: who does each step.'],
        ['Tools are ordinary code', 'Search, code execution, databases and APIs, run by your app.'],
        ['Permissions by risk', 'Read, write, irreversible, never exposed: and the control for each.'],
        ['MCP without the magic', 'An open protocol for connecting apps to tools and data.']
      ]
    },
    '08': {
      label: 'Agents',
      title: 'Agents without the mythology',
      quote: 'An agent is a loop with model-selected decisions.',
      learn: [
        ['Workflow vs agent', 'Who decides the next step: your code or the model.'],
        ['The agent loop', 'Observe, decide, act, update state. Repeat until done or stopped.'],
        ['Errors compound', 'Why a chain of mostly good steps can still fail as a whole.'],
        ['Autonomy by design', 'Where a human approves, and when a plain workflow is the better choice.']
      ]
    },
    '09': {
      label: 'Evals',
      title: 'Building AI you can trust',
      quote: 'A demo is not a system.',
      learn: [
        ['Golden sets', 'A small, versioned set of real cases that defines “working”.'],
        ['Three ways to grade', 'Deterministic checks, human review and LLM judges, and when to use each.'],
        ['Failures and regressions', 'Name the failure type, then rerun the set on every change.'],
        ['Quality, cost, latency', 'Choose what belongs in production, not what won the demo.']
      ]
    }
  };

  var HINT = 'Hover any part of the map to read the module behind it.';
  var parts = map.querySelectorAll('[data-mod]');
  var shown = panel.getAttribute('data-sysmap-panel') || '';

  function tag(name, className, text) {
    var node = document.createElement(name);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function render(id) {
    var module = MODULES[id];
    if (!module || id === shown) return;
    shown = id;

    var next = document.createDocumentFragment();
    next.appendChild(tag('p', 'sysmap-panel-tag', 'Module ' + id + ' · ' + module.label));
    next.appendChild(tag('h3', 'sysmap-panel-title', module.title));
    next.appendChild(tag('blockquote', 'sysmap-panel-quote', '“' + module.quote + '”'));

    var list = tag('ul', 'sysmap-learn');
    module.learn.forEach(function (row) {
      var item = document.createElement('li');
      item.appendChild(tag('b', '', row[0]));
      item.appendChild(tag('span', '', row[1]));
      list.appendChild(item);
    });
    next.appendChild(list);

    var cta = tag('a', 'sysmap-panel-cta', 'Open module ' + id + ' ');
    cta.href = 'module-' + id + '.html';
    var arrow = tag('span', '', '→');
    arrow.setAttribute('aria-hidden', 'true');
    cta.appendChild(arrow);
    next.appendChild(cta);
    next.appendChild(tag('p', 'sysmap-hint', HINT));

    panel.textContent = '';
    panel.appendChild(next);
    panel.setAttribute('data-sysmap-panel', id);

    // The box and its entry in the module list light up together, so the two
    // halves of the widget read as one thing.
    for (var i = 0; i < parts.length; i++) {
      parts[i].classList.toggle('is-lit', parts[i].getAttribute('data-mod') === id);
    }
  }

  function onPoint(event) {
    var part = event.target.closest ? event.target.closest('[data-mod]') : null;
    if (part) render(part.getAttribute('data-mod'));
  }

  map.addEventListener('mouseover', onPoint);
  map.addEventListener('focusin', onPoint);
})();
