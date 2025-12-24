// src/ruleEditor.ts
import { NodeState, OperationKindEnum, RuleItem } from './gum';
import { mapOperationKindToString } from './utils';

export type RuleEditorMode = 'add' | 'edit';

export interface RuleEditorController {
  open(mode: RuleEditorMode, index?: number): void;
  close(): void;
}

/** Pure helper (safe to import in Jest / Node) */
export function getRuleEditorUiLabels(
  mode: RuleEditorMode
): { saveText: string; insertLabel: string } {
  if (mode === 'add') return { saveText: 'Add', insertLabel: 'Insert at:' };
  return { saveText: 'Save', insertLabel: 'Clone at:' };
}

export function getRuleEditorOpKindOptions(): Array<{ kind: OperationKindEnum; label: string }> {
  return [
    { kind: OperationKindEnum.TurnToState,             label: 'Turn to state' },
    { kind: OperationKindEnum.GiveBirthConnected,      label: 'Birth (connected)' },
    { kind: OperationKindEnum.TryToConnectWithNearest, label: 'Connect nearest' },
    { kind: OperationKindEnum.DisconnectFrom,          label: 'Disconnect from' },
    { kind: OperationKindEnum.Die,                     label: 'Die' },
  ];
}

export interface RuleEditorDeps {
  // Simulation control (owned by main.ts)
  pauseForEditor(): void;   // called when opening modal
  stopSimulation(): void;   // called before rebuilding machine/config

  // Current machine/rules access
  getRuleItems(): RuleItem[];
  exportRulesFromMachine(): any[];
  getStartStateToken(): string;

  // Genome/config lifecycle (owned by main.ts)
  getLastLoadedConfig(): any;
  buildMachineBlockFromRuntime(): any;
  clearShareHashIfPresent(): void;

  getCurrentGenomeSource(): string;
  getBaseGenomeLabel(): string;

  setCustomGenomeCache(cfg: any | null): void;
  syncGenomeSelects(value: string): void;
  genomeSelectValues: { CUSTOM: string; NEW: string };

  applyGenomeConfig(cfg: any, labelForSelect: string | null): Promise<void>;
  showToast(msg: string): void;
}

// -------------------- small utils --------------------

function deepClone<T>(value: T): T {
  const sc = (globalThis as any).structuredClone;
  if (typeof sc === 'function') {
    try { return sc(value); } catch { /* fall back */ }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function toStateToken(s: NodeState): string {
  if (s === NodeState.Unknown) return 'Unknown';
  if (s === NodeState.Ignored) return 'any';
  // @ts-ignore enum reverse mapping
  return (NodeState as any)[s] ?? String(s);
}

function setIntField(input: HTMLInputElement, v: number) {
  input.value = (Number.isFinite(v) && v >= 0) ? String(Math.trunc(v)) : '';
}

function readIntField(input: HTMLInputElement): number | undefined {
  const t = input.value.trim();
  if (!t) return undefined;
  const n = parseInt(t, 10);
  if (Number.isNaN(n)) return undefined;
  return Math.trunc(n);
}

// -------------------- DOM (null-safe + strict TS) --------------------

function hasDom(): boolean {
  return typeof document !== 'undefined' && typeof document.getElementById === 'function';
}

function mustGetEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[ruleEditor] Missing required element: #${id}`);
  return el as T;
}

type DomRefs = {
  modal: HTMLDivElement;
  title: HTMLDivElement;
  subtitle: HTMLDivElement;

  enabledChk: HTMLInputElement;

  currentSel: HTMLSelectElement;
  priorSel: HTMLSelectElement;
  connWithStateSel: HTMLSelectElement;
  connGeInput: HTMLInputElement;
  connLeInput: HTMLInputElement;
  parGeInput: HTMLInputElement;
  parLeInput: HTMLInputElement;

  opKindSel: HTMLSelectElement;
  opOperandSel: HTMLSelectElement;
  opHint: HTMLSpanElement;

  insertIndexInput: HTMLInputElement;
  insertLabelEl: HTMLLabelElement | null;

  errorBox: HTMLDivElement;

  removeBtn: HTMLButtonElement;
  cloneBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  saveBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
};

let DOM_CACHE: DomRefs | null = null;

function dom(): DomRefs {
  if (DOM_CACHE) return DOM_CACHE;

  // required
  const modal = mustGetEl<HTMLDivElement>('rule-editor-modal');

  DOM_CACHE = {
    modal,
    title: mustGetEl<HTMLDivElement>('rule-editor-title'),
    subtitle: mustGetEl<HTMLDivElement>('rule-editor-subtitle'),

    enabledChk: mustGetEl<HTMLInputElement>('rule-editor-enabled'),

    currentSel: mustGetEl<HTMLSelectElement>('rule-editor-current'),
    priorSel: mustGetEl<HTMLSelectElement>('rule-editor-prior'),
    connWithStateSel: mustGetEl<HTMLSelectElement>('rule-editor-conn-with-state'),
    connGeInput: mustGetEl<HTMLInputElement>('rule-editor-conn-ge'),
    connLeInput: mustGetEl<HTMLInputElement>('rule-editor-conn-le'),
    parGeInput: mustGetEl<HTMLInputElement>('rule-editor-par-ge'),
    parLeInput: mustGetEl<HTMLInputElement>('rule-editor-par-le'),

    opKindSel: mustGetEl<HTMLSelectElement>('rule-editor-op-kind'),
    opOperandSel: mustGetEl<HTMLSelectElement>('rule-editor-op-operand'),
    opHint: mustGetEl<HTMLSpanElement>('rule-editor-op-hint'),

    insertIndexInput: mustGetEl<HTMLInputElement>('rule-editor-insert-index'),
    insertLabelEl: (document.getElementById('rule-editor-insert-label') as HTMLLabelElement | null),

    errorBox: mustGetEl<HTMLDivElement>('rule-editor-error'),

    removeBtn: mustGetEl<HTMLButtonElement>('rule-editor-remove'),
    cloneBtn: mustGetEl<HTMLButtonElement>('rule-editor-clone'),
    cancelBtn: mustGetEl<HTMLButtonElement>('rule-editor-cancel'),
    saveBtn: mustGetEl<HTMLButtonElement>('rule-editor-save'),
    closeBtn: mustGetEl<HTMLButtonElement>('rule-editor-close'),
  };

  return DOM_CACHE;
}

// -------------------- controller --------------------

export function createRuleEditorController(deps: RuleEditorDeps): RuleEditorController {
  // If called in a non-DOM environment, return no-op controller.
  if (!hasDom()) return { open: () => {}, close: () => {} };

  // If the modal does not exist in DOM, no-op (keeps app working).
  if (!document.getElementById('rule-editor-modal')) return { open: () => {}, close: () => {} };

  let editorState: { mode: RuleEditorMode; index: number } | null = null;
  let selectsReady = false;
  let wired = false;

  function showError(msg: string | null) {
    const d = dom();
    if (!msg) {
      d.errorBox.textContent = '';
      d.errorBox.hidden = true;
      return;
    }
    d.errorBox.textContent = msg;
    d.errorBox.hidden = false;
  }

  function ensureSelects() {
    if (selectsReady) return;
    const d = dom();

    const fillStates = (sel: HTMLSelectElement) => {
      sel.innerHTML = '';
      const add = (v: string) => {
        const o = document.createElement('option');
        o.value = v;
        o.text = v;
        sel.add(o);
      };
      add('any');
      add('Unknown');
      for (let i = NodeState.A; i <= NodeState.Z; i++) {
        // @ts-ignore enum reverse mapping
        add((NodeState as any)[i]);
      }
    };

    fillStates(d.currentSel);
    fillStates(d.priorSel);
    fillStates(d.opOperandSel);
    fillStates(d.connWithStateSel);

    // Operation kinds: canonical values, shorter visible labels (reduces dropdown width)
    d.opKindSel.innerHTML = '';    
    for (const k of getRuleEditorOpKindOptions()) {
      const value = mapOperationKindToString(k.kind);
      const o = document.createElement('option');
      o.value = value;
      o.text = k.label;
      d.opKindSel.add(o);
    }

    selectsReady = true;
  }

  function updateOperandUi() {
    const d = dom();
    const kind = String(d.opKindSel.value);
    const hasOperand = kind !== 'Die';
    d.opOperandSel.disabled = !hasOperand;
    d.opHint.textContent = hasOperand ? '' : 'No operand for Die.';
  }

 function applyModeLabels(mode: RuleEditorMode) {
    const d = dom();
    const labels = getRuleEditorUiLabels(mode);
    d.saveBtn.textContent = labels.saveText;
    if (d.insertLabelEl) d.insertLabelEl.textContent = labels.insertLabel;
    }


  function readForm(): { rule: any; insertAt1: number } | null {
    const d = dom();

    const enabled = !!d.enabledChk.checked;

    const current = String(d.currentSel.value || 'A');
    const prior = String(d.priorSel.value || 'any');
    const conn_with_state = String(d.connWithStateSel.value || 'any');

    const kind = String(d.opKindSel.value || 'TurnToState');
    const operand = String(d.opOperandSel.value || 'any');

    const insertAtRaw = parseInt(d.insertIndexInput.value, 10);
    const insertAt1 = Number.isFinite(insertAtRaw) ? Math.trunc(insertAtRaw) : NaN;

    if (!Number.isFinite(insertAt1) || insertAt1 < 1) {
      showError('Insert position must be a positive integer (1-based).');
      return null;
    }
    if (kind !== 'Die' && !operand) {
      showError('Operand is required for this operation.');
      return null;
    }

    const conn_ge = readIntField(d.connGeInput);
    const conn_le = readIntField(d.connLeInput);
    const parents_ge = readIntField(d.parGeInput);
    const parents_le = readIntField(d.parLeInput);

    const rule: any = {
      enabled,
      condition: {
        current,
        prior,
        ...(conn_with_state !== 'any' ? { conn_with_state } : {}),
        ...(conn_ge !== undefined ? { conn_ge } : {}),
        ...(conn_le !== undefined ? { conn_le } : {}),
        ...(parents_ge !== undefined ? { parents_ge } : {}),
        ...(parents_le !== undefined ? { parents_le } : {}),
      },
      op: {
        kind,
        ...(kind === 'Die' ? {} : { operand }),
      },
    };

    showError(null);
    return { rule, insertAt1 };
  }

  async function commitRuleTable(nextRules: any[]) {
    deps.stopSimulation();

    const prevCfg = deps.getLastLoadedConfig();
    const nextCfg = deepClone(prevCfg ?? {});
    nextCfg.machine = deps.buildMachineBlockFromRuntime();
    nextCfg.init_graph = prevCfg?.init_graph ?? { nodes: [{ state: deps.getStartStateToken() }] };
    nextCfg.rules = nextRules;

    if (nextCfg?.meta && typeof nextCfg.meta === 'object') delete nextCfg.meta.activity_scheme;
    delete nextCfg.activity_scheme;

    deps.clearShareHashIfPresent();

    const shouldCustom = deps.getCurrentGenomeSource() !== 'new';
    const label = shouldCustom ? `Edited: ${deps.getBaseGenomeLabel()}` : null;

    await deps.applyGenomeConfig(nextCfg, label);

    if (shouldCustom) {
      deps.setCustomGenomeCache(deepClone(deps.getLastLoadedConfig()));
      deps.syncGenomeSelects(deps.genomeSelectValues.CUSTOM);
    } else {
      deps.syncGenomeSelects(deps.genomeSelectValues.NEW);
    }

    deps.showToast('Rule table updated — simulation reset.');
  }

  function close() {
    const d = dom();
    d.modal.hidden = true;
    document.body.classList.remove('modal-open');
    editorState = null;
    showError(null);
  }

  function wireOnce() {
    if (wired) return;
    wired = true;

    const d = dom();

    d.closeBtn.addEventListener('click', close);
    d.cancelBtn.addEventListener('click', close);

    // backdrop click closes (your HTML uses data-close="1" on backdrop)
    d.modal.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t?.dataset?.close === '1') close();
    });

    // ESC closes
    document.addEventListener('keydown', (e) => {
      const dd = dom();
      if (e.key === 'Escape' && !dd.modal.hidden) close();
    });

    d.opKindSel.addEventListener('change', updateOperandUi);

    d.saveBtn.addEventListener('click', () => {
      void (async () => {
        if (!editorState) return;
        const parsed = readForm();
        if (!parsed) return;

        const rules = deps.exportRulesFromMachine();

        if (editorState.mode === 'add') {
          const idx0 = clamp(parsed.insertAt1 - 1, 0, rules.length);
          rules.splice(idx0, 0, parsed.rule);
        } else {
          if (editorState.index < 0 || editorState.index >= rules.length) return;
          rules[editorState.index] = parsed.rule;
        }

        close();
        await commitRuleTable(rules);
      })();
    });

    d.removeBtn.addEventListener('click', () => {
      void (async () => {
        if (!editorState || editorState.mode !== 'edit') return;

        const idx = editorState.index;
        const rules = deps.exportRulesFromMachine();
        if (idx < 0 || idx >= rules.length) return;

        const ok = window.confirm(`Remove rule #${idx + 1}?`);
        if (!ok) return;

        rules.splice(idx, 1);
        close();
        await commitRuleTable(rules);
      })();
    });

    d.cloneBtn.addEventListener('click', () => {
      void (async () => {
        if (!editorState || editorState.mode !== 'edit') return;

        const parsed = readForm();
        if (!parsed) return;

        const rules = deps.exportRulesFromMachine();
        const idx0 = clamp(parsed.insertAt1 - 1, 0, rules.length);
        rules.splice(idx0, 0, parsed.rule);

        close();
        await commitRuleTable(rules);
      })();
    });
  }

  function open(mode: RuleEditorMode, index: number = -1) {
    deps.pauseForEditor();
    wireOnce();
    ensureSelects();

    editorState = { mode, index };

    const d = dom();
    Array.from(d.opKindSel.querySelectorAll('option[data-legacy="1"]')).forEach(o => o.remove());
    const count = deps.getRuleItems().length;
    const startTok = deps.getStartStateToken();

    d.title.textContent = (mode === 'add') ? 'Add rule' : `Edit rule #${index + 1}`;
    d.subtitle.textContent = (mode === 'add')
      ? 'Adding will rebuild the machine and reset the graph.'
      : 'Saving, cloning, or removing will rebuild the machine and reset the graph.';

    // Buttons visibility
    d.removeBtn.hidden = (mode === 'add');
    d.cloneBtn.hidden = (mode === 'add');

    applyModeLabels(mode);

    if (mode === 'add') {
      d.enabledChk.checked = true;

      d.currentSel.value = startTok;
      d.priorSel.value = 'any';
      d.connWithStateSel.value = 'any';

      setIntField(d.connGeInput, -1);
      setIntField(d.connLeInput, -1);
      setIntField(d.parGeInput, -1);
      setIntField(d.parLeInput, -1);

      // Use canonical value (option.value), not the short label
      d.opKindSel.value = 'TurnToState';
      d.opOperandSel.value = startTok;

      d.insertIndexInput.value = String(count + 1);
    } else {
      const it = deps.getRuleItems()[index];
      if (!it) return;

      d.enabledChk.checked = !!it.isEnabled;

      d.currentSel.value = toStateToken(it.condition.currentState);
      d.priorSel.value = toStateToken(it.condition.priorState);
      d.connWithStateSel.value = toStateToken((it.condition as any).allConnectionsWithState ?? NodeState.Ignored);

      setIntField(d.connGeInput, it.condition.allConnectionsCount_GE);
      setIntField(d.connLeInput, it.condition.allConnectionsCount_LE);
      setIntField(d.parGeInput, it.condition.parentsCount_GE);
      setIntField(d.parLeInput, it.condition.parentsCount_LE);

      
      const kindValue = mapOperationKindToString(it.operation.kind);
      // If a loaded genome contains a legacy kind we don't show by default, keep it losslessly.
      if (!Array.from(d.opKindSel.options).some(o => o.value === kindValue)) {
        const opt = document.createElement('option');
        opt.value = kindValue;
        opt.text = `Legacy: ${kindValue}`;
        opt.setAttribute('data-legacy', '1');
        d.opKindSel.insertBefore(opt, d.opKindSel.firstChild);
      }
      d.opKindSel.value = kindValue;
      d.opOperandSel.value = toStateToken(it.operation.operandNodeState);

      d.insertIndexInput.value = String(Math.min(count + 1, index + 2));
    }

    updateOperandUi();
    showError(null);

    d.modal.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => d.currentSel.focus());
  }

  return { open, close };
}
