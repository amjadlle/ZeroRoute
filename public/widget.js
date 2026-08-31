(function() {
  if (window.__ZeroRouteWidgetLoaded) return;
  window.__ZeroRouteWidgetLoaded = true;

  var script = document.currentScript || document.querySelector('script[src*="widget.js"]');
  var endpoint = (script && script.getAttribute('data-endpoint')) || (script && script.src ? new URL(script.src).origin : window.location.origin);
  var title = (script && script.getAttribute('data-title')) || 'AI Assistant';
  var persona = (script && script.getAttribute('data-persona')) || 'You are a helpful, professional website AI assistant. Answer questions politely and concisely in markdown.';
  var personaUrl = (script && script.getAttribute('data-persona-url')) || '';
  var knowledge = (script && script.getAttribute('data-knowledge')) || '';
  var knowledgeUrl = (script && script.getAttribute('data-knowledge-url')) || '';
  var greeting = (script && script.getAttribute('data-greeting')) || 'Hi there! 👋 How can I help you today?';
  var brandColor = (script && script.getAttribute('data-color')) || '#ef4444';
  var key = (script && script.getAttribute('data-key')) || '';
  var logo = (script && script.getAttribute('data-logo')) || '';
  var rawPrompts = (script && script.getAttribute('data-prompts')) || '';

  // Inject Styles
  var style = document.createElement('style');
  style.textContent = [
    '.zr-bubble { position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; background: ' + brandColor + '; box-shadow: 0 10px 25px -4px rgba(0,0,0,0.5), 0 4px 10px -2px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 999999; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); border: 2px solid rgba(255,255,255,0.15); box-sizing: border-box; }',
    '.zr-bubble:hover { transform: scale(1.08); box-shadow: 0 14px 28px -2px rgba(0,0,0,0.65); }',
    '.zr-bubble svg { width: 24px; height: 24px; fill: white; pointer-events: none; }',
    '.zr-window { position: fixed; bottom: 84px; right: 20px; width: 350px; max-width: calc(100vw - 32px); height: 470px; max-height: min(500px, 78vh); background: #090a0f; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; box-shadow: 0 20px 45px rgba(0,0,0,0.85); z-index: 999999; display: flex; flex-direction: column; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; opacity: 0; pointer-events: none; transform: translateY(16px) scale(0.96); transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); box-sizing: border-box; }',
    '.zr-window.zr-open { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }',
    '.zr-header { padding: 12px 16px; background: #0f111a; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; }',
    '.zr-title-box { display: flex; align-items: center; gap: 9px; }',
    '.zr-avatar { width: 28px; height: 28px; background: transparent; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px; flex-shrink: 0; }',
    '.zr-avatar img { width: 100%; height: 100%; object-fit: contain; }',
    '.zr-avatar svg { width: 16px; height: 16px; fill: white; }',
    '.zr-title { font-size: 13px; font-weight: 700; color: #f8fafc; line-height: 1.2; }',
    '.zr-badge { font-size: 9.5px; color: #10b981; display: flex; align-items: center; gap: 4px; font-weight: 500; }',
    '.zr-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: #10b981; }',
    '.zr-close { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; font-size: 13px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }',
    '.zr-close:hover { color: white; background: rgba(255,255,255,0.1); }',
    '.zr-messages { flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; font-size: 12.5px; line-height: 1.5; box-sizing: border-box; scrollbar-width: none; -ms-overflow-style: none; }',
    '.zr-messages::-webkit-scrollbar { display: none; width: 0; height: 0; }',
    '.zr-msg { max-width: 86%; padding: 8px 12px; border-radius: 12px; word-break: break-word; white-space: pre-wrap; box-sizing: border-box; }',
    '.zr-msg-bot { align-self: flex-start; background: #151824; color: #e2e8f0; border: 1px solid rgba(255,255,255,0.06); line-height: 1.55; }',
    '.zr-msg-user { align-self: flex-end; background: ' + brandColor + '; color: #ffffff; font-weight: 500; }',
    '.zr-msg pre.zr-code-block { background: #0b0d14; border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; padding: 6px 8px; font-family: "JetBrains Mono", Menlo, monospace; font-size: 10.5px; overflow-x: auto; margin: 4px 0; color: #cbd5e1; white-space: pre; }',
    '.zr-msg code.zr-inline-code { background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 4px; font-family: "JetBrains Mono", Menlo, monospace; font-size: 11px; color: #e2e8f0; }',
    '.zr-msg a.zr-link { color: #60a5fa; text-decoration: underline; word-break: break-all; }',
    '.zr-msg a.zr-link:hover { color: #93c5fd; }',
    '.zr-msg .zr-md-header { display: block; font-size: 12.5px; font-weight: 700; color: #ffffff; margin-top: 6px; margin-bottom: 2px; }',
    '.zr-msg .zr-list-item { display: block; margin: 2px 0; }',
    '.zr-msg .zr-para-gap { height: 6px; }',
    '.zr-msg strong { font-weight: 700; color: #ffffff; }',
    '.zr-chips { display: flex; flex-direction: column; gap: 6px; margin: 2px 0 4px 0; }',
    '.zr-chip { background: #131622; border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; font-size: 11.5px; padding: 7px 11px; border-radius: 10px; cursor: pointer; text-align: left; transition: all 0.2s; font-family: inherit; width: fit-content; max-width: 100%; word-break: break-word; }',
    '.zr-chip:hover { background: #1a1e2e; border-color: rgba(255,255,255,0.22); color: #ffffff; transform: translateY(-1px); }',
    '.zr-typing { display: inline-flex; align-items: center; gap: 4px; padding: 3px 2px; }',
    '.zr-dot { width: 5px; height: 5px; background: #94a3b8; border-radius: 50%; animation: zr-bounce 1.4s infinite ease-in-out both; }',
    '.zr-dot:nth-child(1) { animation-delay: -0.32s; }',
    '.zr-dot:nth-child(2) { animation-delay: -0.16s; }',
    '@keyframes zr-bounce { 0%, 80%, 100% { transform: scale(0.35); opacity: 0.35; } 40% { transform: scale(1); opacity: 1; } }',
    '.zr-footer { padding: 10px 12px; background: #0f111a; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 7px; box-sizing: border-box; }',
    '.zr-input { flex: 1; background: #181b2a; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 8px 10px; color: white; font-size: 11.5px; outline: none; box-sizing: border-box; }',
    '.zr-input:focus { border-color: ' + brandColor + '; }',
    '.zr-send { background: ' + brandColor + '; border: none; border-radius: 10px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; font-size: 12px; transition: opacity 0.2s; }',
    '.zr-send:hover { opacity: 0.9; }',
    '.zr-send:disabled { opacity: 0.4; cursor: not-allowed; }',
    '.zr-powered { text-align: center; font-size: 9.5px; color: #64748b; padding: 3px; background: #090a0f; }',
    '.zr-powered a { color: #94a3b8; text-decoration: none; font-weight: 600; }',
    '@media (max-width: 480px) {',
    '  .zr-bubble { bottom: 16px; right: 16px; width: 48px; height: 48px; }',
    '  .zr-window { bottom: 72px; right: 14px; width: calc(100vw - 28px); max-width: 340px; height: 420px; max-height: 65vh; border-radius: 16px; }',
    '  .zr-header { padding: 10px 12px; }',
    '  .zr-messages { padding: 10px; font-size: 12px; }',
    '  .zr-footer { padding: 8px 10px; }',
    '  .zr-input { font-size: 16px !important; }',
    '}'
  ].join('');
  document.head.appendChild(style);

  // Floating Bubble
  var bubble = document.createElement('div');
  bubble.className = 'zr-bubble';
  bubble.id = 'zr-toggle-btn';
  bubble.setAttribute('aria-label', 'Open AI Chat');
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';

  // Chat Window Container
  var win = document.createElement('div');
  win.className = 'zr-window';

  // Header
  var header = document.createElement('div');
  header.className = 'zr-header';

  var titleBox = document.createElement('div');
  titleBox.className = 'zr-title-box';

  var avatar = document.createElement('div');
  avatar.className = 'zr-avatar';
  var botSvg = '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5"/></svg>';

  if (logo) {
    var avatarImg = document.createElement('img');
    avatarImg.src = logo;
    avatarImg.alt = title;
    avatarImg.onerror = function() {
      avatarImg.remove();
      avatar.innerHTML = botSvg;
      avatar.style.background = brandColor;
      avatar.style.borderRadius = '8px';
    };
    avatar.appendChild(avatarImg);
  } else {
    avatar.innerHTML = botSvg;
    avatar.style.background = brandColor;
    avatar.style.borderRadius = '8px';
  }

  var infoBox = document.createElement('div');
  var titleEl = document.createElement('div');
  titleEl.className = 'zr-title';
  titleEl.textContent = title;

  var badgeEl = document.createElement('div');
  badgeEl.className = 'zr-badge';
  var dot = document.createElement('span');
  dot.className = 'zr-badge-dot';
  badgeEl.appendChild(dot);
  var badgeText = document.createTextNode(' Online • ZeroRoute');
  badgeEl.appendChild(badgeText);

  infoBox.appendChild(titleEl);
  infoBox.appendChild(badgeEl);
  titleBox.appendChild(avatar);
  titleBox.appendChild(infoBox);

  var closeBtn = document.createElement('button');
  closeBtn.className = 'zr-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close AI Chat');

  header.appendChild(titleBox);
  header.appendChild(closeBtn);

  // Message Area
  var msgBox = document.createElement('div');
  msgBox.className = 'zr-messages';

  var initialMsg = document.createElement('div');
  initialMsg.className = 'zr-msg zr-msg-bot';
  initialMsg.textContent = greeting;
  msgBox.appendChild(initialMsg);

  // Quick Prompt Chips (if provided)
  var chipsContainer = null;
  if (rawPrompts) {
    chipsContainer = document.createElement('div');
    chipsContainer.className = 'zr-chips';
    var promptItems = rawPrompts.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    promptItems.forEach(function(promptText) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'zr-chip';
      chip.textContent = promptText;
      chip.onclick = function() {
        inputBox.value = promptText;
        if (chipsContainer) {
          chipsContainer.remove();
          chipsContainer = null;
        }
        send();
      };
      chipsContainer.appendChild(chip);
    });
    msgBox.appendChild(chipsContainer);
  }

  // Footer Input Area
  var footer = document.createElement('div');
  footer.className = 'zr-footer';

  var inputBox = document.createElement('input');
  inputBox.type = 'text';
  inputBox.className = 'zr-input';
  inputBox.placeholder = 'Ask a question…';

  var sendBtn = document.createElement('button');
  sendBtn.className = 'zr-send';
  sendBtn.textContent = '➤';
  sendBtn.setAttribute('aria-label', 'Send message');

  footer.appendChild(inputBox);
  footer.appendChild(sendBtn);

  // Powered By
  var powered = document.createElement('div');
  powered.className = 'zr-powered';
  powered.innerHTML = 'Fast free AI by <a href="https://github.com/amjadlle/ZeroRoute" target="_blank" rel="noopener">ZeroRoute</a>';

  win.appendChild(header);
  win.appendChild(msgBox);
  win.appendChild(footer);
  win.appendChild(powered);

  function mount() {
    document.body.appendChild(bubble);
    document.body.appendChild(win);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  var isOpen = false;
  var isBusy = false;
  var history = [];

  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      win.classList.add('zr-open');
      inputBox.focus();
    } else {
      win.classList.remove('zr-open');
    }
  }

  window.ZeroRoute = {
    toggle: toggle,
    open: function() { if (!isOpen) toggle(); },
    close: function() { if (isOpen) toggle(); }
  };

  bubble.onclick = toggle;
  closeBtn.onclick = toggle;

  var loadedPersona = persona;
  var loadedKnowledge = knowledge;

  async function loadRemoteContext() {
    if (personaUrl && loadedPersona === persona) {
      try {
        var pRes = await fetch(personaUrl);
        if (pRes.ok) loadedPersona = await pRes.text();
      } catch (e) {}
    }
    if (knowledgeUrl && loadedKnowledge === knowledge) {
      try {
        var kRes = await fetch(knowledgeUrl);
        if (kRes.ok) loadedKnowledge = await kRes.text();
      } catch (e) {}
    }
  }
  loadRemoteContext();

  function buildFullSystemPrompt() {
    var p = loadedPersona.trim();
    if (loadedKnowledge && loadedKnowledge.trim()) {
      p += '\n\n[VERIFIED BUSINESS KNOWLEDGE BASE]\n' + 
        'Base your answers strictly on the following verified facts, services, and documentation for this website. ' +
        'If a specific detail is not covered, politely explain that you do not have that specific information and invite the visitor to contact support:\n\n' + 
        loadedKnowledge.trim();
    }
    return p;
  }

  async function send() {
    var text = inputBox.value.trim();
    if (!text || isBusy) return;
    inputBox.value = '';
    isBusy = true;
    sendBtn.disabled = true;

    // Ensure remote context is loaded
    if ((personaUrl && loadedPersona === persona) || (knowledgeUrl && loadedKnowledge === knowledge)) {
      await loadRemoteContext();
    }

    // Safe user text rendering (XSS protection via textContent)
    var userEl = document.createElement('div');
    userEl.className = 'zr-msg zr-msg-user';
    userEl.textContent = text;
    msgBox.appendChild(userEl);
    history.push({ role: 'user', content: text });

    // Safe bot placeholder with animated typing indicator
    var botEl = document.createElement('div');
    botEl.className = 'zr-msg zr-msg-bot';
    botEl.innerHTML = '<span class="zr-typing"><span class="zr-dot"></span><span class="zr-dot"></span><span class="zr-dot"></span></span>';
    msgBox.appendChild(botEl);
    msgBox.scrollTop = msgBox.scrollHeight;

    try {
      var headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = 'Bearer ' + key;

      var res = await fetch(endpoint + '/v1/chat/completions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          stream: true,
          messages: [
            { role: 'system', content: buildFullSystemPrompt() }
          ].concat(history)
        })
      });

      if (!res.ok) {
        var errData = await res.json().catch(function() { return {}; });
        var errMsg = (errData && errData.error && (errData.error.message || errData.error)) || ('HTTP ' + res.status + ' Error');
        botEl.textContent = '⚠️ ' + errMsg;
        isBusy = false;
        sendBtn.disabled = false;
        return;
      }

      function escapeHtml(str) {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      function renderMarkdown(md) {
        if (!md) return '';
        var safe = escapeHtml(md);

        // Code blocks ```...```
        safe = safe.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g, function(_, lang, code) {
          return '<pre class="zr-code-block"><code>' + code.trim() + '</code></pre>';
        });

        // Inline code `...`
        safe = safe.replace(/`([^`\n]+)`/g, '<code class="zr-inline-code">$1</code>');

        // Headers (###, ##, #)
        safe = safe.replace(/^(?:###|##|#)\s+(.+)$/gm, '<span class="zr-md-header">$1</span>');

        // Bold (**text** or __text__)
        safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        safe = safe.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // Italic (*text* or _text_)
        safe = safe.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');

        // Links [text](url) - safe protocols only
        safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+|mailto:[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="zr-link">$1</a>');

        // Lists
        safe = safe.replace(/^[\*\-]\s+(.+)$/gm, '<span class="zr-list-item">• $1</span>');
        safe = safe.replace(/^(\d+)\.\s+(.+)$/gm, '<span class="zr-list-item"><strong style="color:#ffffff;">$1.</strong> $2</span>');

        // Paragraph gaps & newlines
        safe = safe.replace(/\n\n+/g, '<div class="zr-para-gap"></div>');
        safe = safe.replace(/\n/g, '<br>');

        return safe;
      }

      botEl.textContent = '';
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var fullBot = '';

      while (true) {
        var chunkResult = await reader.read();
        if (chunkResult.done) break;
        var chunk = decoder.decode(chunkResult.value);
        var lines = chunk.split('\n');
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.startsWith('data:') && line !== 'data: [DONE]') {
            try {
              var data = JSON.parse(line.slice(5).trim());
              var content = (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) || '';
              fullBot += content;
              botEl.innerHTML = renderMarkdown(fullBot);
              msgBox.scrollTop = msgBox.scrollHeight;
            } catch (e) {}
          }
        }
      }
      history.push({ role: 'assistant', content: fullBot });
    } catch (err) {
      botEl.textContent = '⚠️ Network error: ' + (err.message || 'Unable to connect');
    } finally {
      isBusy = false;
      sendBtn.disabled = false;
    }
  }

  sendBtn.onclick = send;
  inputBox.onkeydown = function(e) {
    if (e.key === 'Enter') send();
  };
})();
