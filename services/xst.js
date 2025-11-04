// xst.js
class XST {
  constructor(options = {}) {
    this.startTime = Date.now();
    this.timeLimitMs = options.timeLimitMs ?? 300_000; // 5 min default
    this.hasTimeLimit = options.timeLimitMs !== null;
    this.notes = []; // persistent notes
    this.idleStreak = 0;
    this.userQueue = [];
    this.running = true;

    // Bind methods for external use
    this.postUserMessage = this.postUserMessage.bind(this);
    this.getLLMMessage = this.getLLMMessage.bind(this);
    this.processLLMResponse = this.processLLMResponse.bind(this);
  }

  // --- USER TO XST (plain text) ---
  postUserMessage(text) {
    if (typeof text !== 'string') return;
    this.userQueue.push({ type: 'user_msg', content: text, ts: Date.now() });
  }

  // --- XST TO LLM (JSON) ---
  getLLMMessage() {
    const now = Date.now();
    const usedMs = now - this.startTime;
    const leftMs = this.hasTimeLimit ? Math.max(0, this.timeLimitMs - usedMs) : null;

    const base = {
      type: 'status',
      time: new Date().toISOString(),
      usedMs,
      leftMs,
      user_msgs: this.userQueue.splice(0), // consume all pending
      idleStreak: this.idleStreak,
      suggestion: this.idleStreak >= 3 ? 'Consider using {cmd:"sleep", ms:1000} to pause.' : null
    };

    // Reset idle streak when we send real info
    if (base.user_msgs.length > 0) this.idleStreak = 0;

    return JSON.stringify(base) + '\n';
  }

  // --- LLM TO XST (JSON) ---
  processLLMResponse(jsonLine) {
    let actions;
    try {
      actions = JSON.parse(jsonLine);
      if (!Array.isArray(actions)) actions = [actions];
    } catch (e) {
      return { error: 'Invalid JSON from LLM' };
    }

    const results = [];
    let finalMessage = null;

    for (const act of actions) {
      const cmd = act.cmd;
      const args = act.args || {};

      let res = { cmd };

      switch (cmd) {
        case 'time':
          res.result = new Date().toISOString();
          break;

        case 'sleep':
          const ms = Math.min(Math.max(0, args.ms || 0), 5000);
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
          res.result = `Slept ${ms}ms`;
          this.idleStreak = 0;
          break;

        case 'message':
          finalMessage = args.text ?? '';
          res.result = 'Sent to user';
          break;

        case 'noteToSelf':
          this.notes.push({ text: args.text, ts: new Date().toISOString() });
          res.result = 'Note saved';
          break;

        case 'notes':
          res.result = this.notes.length ? this.notes : null;
          break;

        case 'idle':
          res.result = 'Idling...';
          this.idleStreak++;
          break;

        case 'think':
          res.result = 'Thinking...';
          this.idleStreak = 0;
          break;

        case 'help':
          res.result = {
            commands: {
              time: 'Get current ISO time',
              sleep: '{ms: N} – pause N ms (does not count toward time limit)',
              message: '{text: "..."} – send to user',
              noteToSelf: '{text: "..."} – save note',
              notes: 'View all notes',
              idle: 'Do nothing this loop',
              think: 'Internal thought (resets idle)',
              help: 'This help'
            },
            status_fields: 'time, usedMs, leftMs, user_msgs, idleStreak, suggestion'
          };
          break;

        default:
          res.error = `Unknown command: ${cmd}`;
      }
      results.push(res);
    }

    // Auto-send message if requested
    if (finalMessage !== null) {
      this._emitUserMessage(finalMessage);
    }

    return { results };
  }

  // --- XST TO USER (plain text) ---
  _emitUserMessage(text) {
    if (this.onUserMessage) this.onUserMessage(text);
    else console.log('[XST → USER]', text);
  }

  // Optional: hook for your UI
  set onUserMessage(callback) { this._onUserMessage = callback; }
  get onUserMessage() { return this._onUserMessage; }

  // Check if time is up
  isTimeUp() {
    if (!this.hasTimeLimit) return false;
    return Date.now() - this.startTime >= this.timeLimitMs;
  }

  // End session
  stop() {
    this.running = false;
  }
}

// Export for Node.js / Browser (via bundler)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { XST };
} else if (typeof window !== 'undefined') {
  window.XST = XST;
}