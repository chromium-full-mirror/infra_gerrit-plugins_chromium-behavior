/**
 * @license
 * Copyright 2022 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {PluginApi} from '@gerritcodereview/typescript-api/plugin';
import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators';

const CORP_KEYWORD = '.corp.google';
export const CORP_WARNER_ELEMENT = 'corp-warner';

declare global {
  interface HTMLElementTagNameMap {
    [CORP_WARNER_ELEMENT]: CorpWarner;
  }
}

export function installCorpWarner(plugin: PluginApi) {
  plugin.registerCustomComponent('comment', CORP_WARNER_ELEMENT, {
    slot: 'above-actions',
  });
  plugin.registerCustomComponent('reply-bottom', CORP_WARNER_ELEMENT, {
    slot: 'above-actions',
  });
}

@customElement(CORP_WARNER_ELEMENT)
export class CorpWarner extends LitElement {
  @property({type: Boolean}) isDraft?: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @property() comment?: any;

  @property({type: String}) message?: string;

  static override styles = css`
    .container {
      background-color: var(--warning-background);
      padding: var(--spacing-s) var(--spacing-m);
      font-family: var(--font-family);
      display: flex;
      align-items: center;
    }

    .warning-icon {
      color: var(--warning-foreground);
      margin-right: 5px;
    }
  `;

  override render() {
    // Don't warn on comments that have already been posted.
    if (!this.isDraft) return;

    // this.message updates once every letter but is '' on page load.
    // this.comment.message doesn't update frequently but contains the full
    // comment message on page load. Warn on both.
    if (
      !(
        this.comment?.message?.includes(CORP_KEYWORD) ||
        this.message?.includes(CORP_KEYWORD)
      )
    ) {
      return;
    }
    return html`<div class="container">
      <gr-icon icon="warning" filled class="warning-icon"></gr-icon>
      <a>
        Prefer public over corp URLs, for example "chromium.googlesource.com".
      </a>
    </div>`;
  }
}
