// xst.js
class XST {
  constructor(options = {}) {
    this.startTime = Date.now();
    this.timeLimitMs = options.timeLimitMs ?? 300_000; // 5 min default
    this.hasTimeLimit = options.timeLimitMs !== null;
    this.notes = [];
    this.idleStreak = 0;
    this.userQueue = [];
    this.running = true;
    this._onUserMessage = null;
  }

  postUserMessage(text) {
    if (typeof text !== 'string') return;
    this.userQueue.push({ type: 'user_msg', content: text, ts: Date.now() });
  }

  getLLMMessage() {
    const now = Date.now();
    const usedMs = now - this.startTime;
    const leftMs = this.hasTimeLimit ? Math.max(0, this.timeLimitMs - usedMs) : null;

    const base = {
      type: 'status',
      time: new Date().toISOString(),
      usedMs,
      leftMs,
      user_msgs: this.userQueue.splice(0),
      idleStreak: this.idleStreak,
      suggestion: this.idleStreak >= 3 ? 'Consider using {cmd:"sleep", ms:1000} to pause.' : null
    };

    if (base.user_msgs.length > 0) this.idleStreak = 0;

    return JSON.stringify(base) + '\n';
  }

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
              sleep: '{ms: N} – pause N ms (no time cost)',
              message: '{text: "..."} – send to user',
              noteToSelf: '{text: "..."} – save note',
              notes: 'View all notes',
              idle: 'Do nothing',
              think: 'Think (resets idle)',
              help: 'Show this help'
            },
            status: 'time, usedMs, leftMs, user_msgs, idleStreak, suggestion'
          };
          break;

        default:
          res.error = `Unknown command: ${cmd}`;
      }
      results.push(res);
    }

    if (finalMessage !== null) {
      this._emitUserMessage(finalMessage);
    }

    return { results };
  }

  _emitUserMessage(text) {
    if (this._onUserMessage) this._onUserMessage(text);
    else console.log('[XST → USER]', text);
  }

  set onUserMessage(cb) { this._onUserMessage = cb; }
  get onUserMessage() { return this._onUserMessage; }

  isTimeUp() {
    if (!this.hasTimeLimit) return false;
    return Date.now() - this.startTime >= this.timeLimitMs;
  }

  stop() { this.running = false; }
}

// EXPORT FOR ESM
export { XST };
