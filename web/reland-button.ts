/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {PluginApi} from '@gerritcodereview/typescript-api/plugin';
import {PopupPluginApi} from '@gerritcodereview/typescript-api/popup';

import {
  AccountInfo,
  ChangeInfo,
} from '@gerritcodereview/typescript-api/rest-api';

import {
  ActionType,
  ChangeActions,
  ChangeActionsPluginApi,
} from '@gerritcodereview/typescript-api/change-actions';

import {html, LitElement} from 'lit';

import {customElement, property} from 'lit/decorators';

import {
  REVIEW_LABEL,
  STATUS_SUBMITTED,
  getLabelMaxValue,
  getTrailer,
  isLabelVotePermitted,
} from './common';

let _CUSTOM_RELAND_KEY: string | null = null;
let _NEW_KEY: string | null = null;
let _CURR_CHANGE: ChangeInfo | null = null;
let _RELAND_POPUP: PopupPluginApi | null = null;

/**
 * Adds a "Reland" button to the page if appropriate.
 *
 * @param plugin - the plugin object
 * @param change - the object for the current change
 */
export async function maybeInstallReland(
  plugin: PluginApi,
  change: ChangeInfo
) {
  if (change.status !== STATUS_SUBMITTED) {
    return;
  }

  const changeActions = plugin.changeActions();

  if (_CUSTOM_RELAND_KEY !== null) {
    changeActions.remove(_CUSTOM_RELAND_KEY);
  }

  installRelandButton(plugin, change, changeActions);

  // Show neither the Revert nor Reland actions to non-committer drive-bys.
  const currentUser: AccountInfo = await plugin
    .restApi()
    .get('/accounts/self/detail');
  const reviewLabelMaxValue = getLabelMaxValue(change, REVIEW_LABEL);

  if (
    currentUser.email !== change.owner.email &&
    !isLabelVotePermitted(change, REVIEW_LABEL, `+${reviewLabelMaxValue}`)
  ) {
    changeActions.removePrimaryActionKey(ChangeActions.REVERT);
    changeActions.setActionOverflow(
      ActionType.CHANGE,
      ChangeActions.REVERT,
      true
    );
    if (_CUSTOM_RELAND_KEY) {
      changeActions.removePrimaryActionKey(_CUSTOM_RELAND_KEY);
      changeActions.setActionOverflow(
        ActionType.CHANGE,
        _CUSTOM_RELAND_KEY,
        true
      );
    }
  }
}

/**
 * Adds a "Reland" button to the page.
 *
 * @param plugin - the plugin object
 * @param change - the object for the current change
 * @param changeActions - the object that contains requested
 * action changes
 */
function installRelandButton(
  plugin: PluginApi,
  change: ChangeInfo,
  changeActions: ChangeActionsPluginApi
) {
  _CURR_CHANGE = change;
  _NEW_KEY = changeActions.add(ActionType.CHANGE, 'Create Reland');
  changeActions.setEnabled(_NEW_KEY, true);
  const handler = async function () {
    if (_RELAND_POPUP) {
      // Make sure the popup is completely closed before we open it.
      _RELAND_POPUP.close();
      await _RELAND_POPUP.open();
    } else {
      _RELAND_POPUP = await plugin.popup(RelandPopup.is);
    }
  };
  changeActions.addTapListener(_NEW_KEY, handler);
  _CUSTOM_RELAND_KEY = _NEW_KEY;
}

/**
 * createReland relands a change with a given notification level.
 *
 * @param plugin - the plugin object
 * @param notify - the notification level
 */
async function createReland(plugin: PluginApi, notify: string) {
  if (!_NEW_KEY || !_CURR_CHANGE) {
    console.error('New key or current change is not set');
    return;
  }
  if (!_CURR_CHANGE.revisions || !_CURR_CHANGE.current_revision) {
    console.error('No revision / current revision found.');
    return;
  }
  const currentRevision = _CURR_CHANGE.revisions[_CURR_CHANGE.current_revision];
  if (!currentRevision) {
    console.error('No current revision in revisions.');
    return;
  }

  const changeActions = plugin.changeActions();
  changeActions.setEnabled(_NEW_KEY, false);
  changeActions.setLabel(_NEW_KEY, 'Reopening...');
  let orig = '';
  if (currentRevision.commit) {
    orig = currentRevision.commit.message.trim();
  }
  const subject = 'Reland "' + _CURR_CHANGE.subject + '"\n\n';
  const disclaimer =
    `This is a reland of ${_CURR_CHANGE.current_revision}` +
    "\n\nOriginal change's description:\n";
  const quote = orig.replace(/^/gm, '> ').replace(/^> $/gm, '>');
  let message = subject + disclaimer + quote;
  const bugFooter = getTrailer(orig, 'Bug');
  const cqFooter = getTrailer(orig, 'Cq-Include-Trybots');
  if (bugFooter || cqFooter) {
    message += '\n\n' + bugFooter + cqFooter;
  }
  const url =
    '/changes/' +
    String(_CURR_CHANGE._number) +
    '/revisions/' +
    String(_CURR_CHANGE.revisions[_CURR_CHANGE.current_revision]._number) +
    '/cherrypick';
  const body = {
    message: message.trim(),
    destination: _CURR_CHANGE.branch,
    notify,
    keep_reviewers: true,
  };
  try {
    const response: ChangeInfo = await plugin.restApi().post(url, body);
    window.location.pathname = `'/c/${response._number}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    changeActions.setLabel(_NEW_KEY, "Can't reland");
    changeActions.setEnabled(_NEW_KEY, false);
    changeActions.ensureEl().dispatchEvent(
      new CustomEvent('show-alert', {
        detail: {message: `Cannot reland: ${err.message}`},
        composed: true,
        bubbles: true,
      })
    );
    throw err;
  }
}

@customElement('reland-popup')
class RelandPopup extends LitElement {
  // Guaranteed to be provided by the 'popup'.
  @property()
  plugin!: PluginApi;

  override render() {
    return html` <gr-dialog
      id="relandDialog"
      confirm-label="Notify Reviewers"
      @confirm=${this.handleConfirm}
      cancel-label="Reland Without Notifying"
      @cancel=${this.handleCancel}
    >
      <div class="main" slot="main">
        Click "Notify Reviewers" if you would like to send this<br />
        reland to reviewers, or "Reland Without Notifying" if not.<br />
      </div>
    </gr-dialog>`;
  }

  static get is() {
    return 'reland-popup';
  }

  private handleConfirm() {
    this.createReland('ALL');
    if (_RELAND_POPUP) {
      _RELAND_POPUP.close();
    }
  }

  private handleCancel() {
    this.createReland('OWNER');
    if (_RELAND_POPUP) {
      _RELAND_POPUP.close();
    }
  }

  private async createReland(notify: string) {
    try {
      await createReland(this.plugin, notify);
    } catch (err) {
      console.error(err);
    }
  }
}
