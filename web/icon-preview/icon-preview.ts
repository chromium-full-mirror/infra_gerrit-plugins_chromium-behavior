/**
 * @license
 * Copyright 2026 The Chromium Authors
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {EventType, PluginApi} from '@gerritcodereview/typescript-api/plugin';
import {LitElement, css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {IconPreview, iconToSvgs} from './vector-icon';

/** Shared by the button and the view, which live in different endpoints. */
export interface PreviewState {
  patchNum?: string | number;
  basePatchNum?: string | number;
  path?: string;
  /** Both versions of the file; undefined if not available. */
  files?: Files;
  show: boolean;
}

/** File contents for each side; null if the file doesn't exist on that side. */
export interface Files {
  base: string | null;
  rev: string | null;
}

const bus = new EventTarget();
export const state: PreviewState = {show: false};

export function updateState(p: Partial<PreviewState>) {
  Object.assign(state, p);
  bus.dispatchEvent(new Event('change'));
}

export function onStateChange(cb: () => void): () => void {
  bus.addEventListener('change', cb);
  return () => bus.removeEventListener('change', cb);
}

/** Resets state; for tests. */
export function resetState() {
  for (const k of Object.keys(state) as (keyof PreviewState)[]) {
    delete state[k];
  }
  state.show = false;
}

export function isIconPath(path?: string): boolean {
  return !!path && path.endsWith('.icon');
}

export function isParentBase(basePatchNum?: string | number): boolean {
  return (
    basePatchNum === undefined ||
    basePatchNum === 'PARENT' ||
    Number(basePatchNum) < 0
  );
}

interface DiffChunk {
  ab?: string[];
  a?: string[];
  b?: string[];
  skip?: number;
}

/** The subset of Gerrit's DiffInfo used here. */
export interface Diff {
  meta_a?: unknown;
  meta_b?: unknown;
  content: DiffChunk[];
}

/**
 * Rebuilds both versions of the file from a diff. Returns undefined if the
 * diff skips common lines (only done for very large files).
 */
export function diffToFiles(diff?: Diff): Files | undefined {
  if (!diff || diff.content.some(c => c.skip)) return undefined;
  const side = (meta: unknown, key: 'a' | 'b') =>
    meta
      ? diff.content
          .flatMap(c => [...(c.ab ?? []), ...(c[key] ?? [])])
          .join('\n')
      : null;
  return {base: side(diff.meta_a, 'a'), rev: side(diff.meta_b, 'b')};
}

/** Returns a data: URL for displaying the (ASCII-only) SVG in an <img>. */
export function svgToImgSrc(svg: string): string {
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

/** "Preview" / "Source diff" toggle in the diff header. */
@customElement('chromium-vector-icon-preview-button')
export class IconPreviewButton extends LitElement {
  private unsubscribe?: () => void;

  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
    }
    .separator {
      border-left: var(--border-width, 1px) solid var(--border-color, #ddd);
      height: 20px;
      margin: 0 var(--spacing-m, 8px);
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = onStateChange(() => this.requestUpdate());
  }

  override disconnectedCallback() {
    this.unsubscribe?.();
    super.disconnectedCallback();
  }

  override render() {
    if (!isIconPath(state.path) || !state.files) return nothing;
    const title = state.show
      ? 'Switch to source diff'
      : 'Switch to rendered icon preview';
    return html`<gr-tooltip-content has-tooltip position-below title=${title}>
        <gr-button link @click=${this.toggle}>
          <gr-icon icon=${state.show ? 'code' : 'preview'} filled></gr-icon>
          ${state.show ? 'Source diff' : 'Preview'}
        </gr-button>
      </gr-tooltip-content>
      <span class="separator"></span>`;
  }

  toggle() {
    updateState({show: !state.show});
  }
}

/** Result for one side: previews, an error message, or null = no file. */
type Side = IconPreview[] | string | null;

function convert(text: string | null): Side {
  if (text === null) return null;
  const r = iconToSvgs(text);
  return 'error' in r ? r.error : r.svgs;
}

/** Preview content; setting `replace-content` makes Gerrit hide the diff. */
@customElement('chromium-vector-icon-preview-view')
export class IconPreviewView extends LitElement {
  private unsubscribe?: () => void;

  private diffHost?: Element & {diff?: Diff};

  private readonly onDiffChanged = () =>
    updateState({files: diffToFiles(this.diffHost?.diff)});

  static override styles = css`
    :host {
      display: block;
    }
    .wrap {
      padding: var(--spacing-l, 12px) var(--spacing-xl, 16px);
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    h3 {
      margin: 0 0 8px;
      font-weight: var(--font-weight-bold, 500);
    }
    .rep {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 16px;
    }
    .cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--deemphasized-text-color, #5f6368);
    }
    .bg {
      background: repeating-conic-gradient(#e8eaed 0 25%, #ffffff 0 50%) 0 0 /
        12px 12px;
      border: 1px solid var(--border-color, #ddd);
      line-height: 0;
    }
    .err {
      color: var(--error-foreground, #c5221f);
    }
    .muted {
      color: var(--deemphasized-text-color, #5f6368);
      font-style: italic;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = onStateChange(() => this.sync());
    this.diffHost =
      this.parentElement?.querySelector('gr-diff-host') ?? undefined;
    this.diffHost?.addEventListener('diff-changed', this.onDiffChanged);
    if (this.diffHost) this.onDiffChanged();
    this.sync();
  }

  override disconnectedCallback() {
    this.unsubscribe?.();
    this.diffHost?.removeEventListener('diff-changed', this.onDiffChanged);
    super.disconnectedCallback();
  }

  private sync() {
    const on = state.show && !!state.files;
    this.toggleAttribute('replace-content', on);
    this.requestUpdate();
  }

  override render() {
    if (!this.hasAttribute('replace-content')) return nothing;
    const baseLabel = isParentBase(state.basePatchNum)
      ? 'Base'
      : `Patchset ${state.basePatchNum}`;
    return html`<div class="wrap">
      <div class="grid">
        ${this.renderSide(baseLabel, convert(state.files!.base))}
        ${this.renderSide(
          `Patchset ${state.patchNum}`,
          convert(state.files!.rev),
        )}
      </div>
    </div>`;
  }

  private renderSide(label: string, v: Side) {
    return html`<div class="col">
      <h3>${label}</h3>
      ${this.renderSideContent(v)}
    </div>`;
  }

  private renderSideContent(v: Side) {
    if (v === null) return html`<span class="muted">No file</span>`;
    if (typeof v === 'string') {
      return html`<span class="err">Preview unavailable: ${v}</span>`;
    }
    return html`${v.map(p => this.renderRep(p))}`;
  }

  private renderRep(p: IconPreview) {
    const src = svgToImgSrc(p.svg);
    // Native size (or 24px for very large canvases) plus a 96px enlargement.
    const sizes = [p.size <= 48 ? p.size : 24, 96];
    return html`<div class="rep">
      ${sizes.map(
        (px, i) => html`<div class="cell">
          <div class="bg">
            <img
              alt="icon preview"
              draggable="false"
              width=${px}
              height=${px}
              src=${src}
            />
          </div>
          ${i === 0 ? `${p.size}px canvas` : `${px}px`}
        </div>`,
      )}
    </div>`;
  }
}

/**
 * Gerrit hosts (as returned by getGerritHost()) where the preview is enabled.
 * chromium-behavior is loaded on many GoB hosts; .icon files are Chromium's
 * format, so only enable it where Chromium code is reviewed.
 */
export const ICON_PREVIEW_HOSTS: readonly string[] = [
  'chromium',
  'chrome-internal',
];

export function isIconPreviewHost(gerritHost: string): boolean {
  return ICON_PREVIEW_HOSTS.includes(gerritHost);
}

interface ShowDiffPatchRange {
  patchNum?: string | number;
  basePatchNum?: string | number;
}
interface ShowDiffFileRange {
  path?: string;
}

/** Visible for testing. SHOW_DIFF signature: (change, patchRange, fileRange). */
export function onShowDiff(
  _change: unknown,
  patchRange?: ShowDiffPatchRange,
  fileRange?: ShowDiffFileRange,
) {
  const path = fileRange?.path;
  updateState({
    patchNum: patchRange?.patchNum,
    basePatchNum: patchRange?.basePatchNum,
    path,
    // Keep the user's choice while moving between .icon files.
    show: isIconPath(path) ? state.show : false,
  });
}

export function installIconPreview(plugin: PluginApi) {
  plugin.registerCustomComponent(
    'diff-header-controls',
    'chromium-vector-icon-preview-button',
  );
  plugin.registerCustomComponent(
    'diff-content',
    'chromium-vector-icon-preview-view',
  );
  plugin.on(EventType.SHOW_DIFF, onShowDiff);
}

declare global {
  interface HTMLElementTagNameMap {
    'chromium-vector-icon-preview-button': IconPreviewButton;
    'chromium-vector-icon-preview-view': IconPreviewView;
  }
}
