// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {REVIEW_LABEL, STATUS_SUBMITTED, getLabelMaxValue, getTrailer,
  isLabelVotePermitted} from './common.js';

import {relandPopupTemplate} from './reland-popup-html.js';

let _CUSTOM_RELAND_KEY = null;
let _NEW_KEY = null;
let _CURR_CHANGE = null;
let _RELAND_POPUP = null;

/**
 * Adds a "Reland" button to the page if appropriate.
 * @param {Plugin} plugin: the plugin object
 * @param {ChangeInfo} change: the object for the current change
 */
export async function maybeInstallReland(plugin, change) {
  if (change.status !== STATUS_SUBMITTED) {
    return;
  }

  const changeActions = plugin.changeActions();

  if (_CUSTOM_RELAND_KEY !== null) {
    changeActions.remove(_CUSTOM_RELAND_KEY);
  }

  installRelandButton(plugin, change, changeActions);

  // Show neither the Revert nor Reland actions to non-committer drive-bys.
  const currentUser = await plugin.restApi().get('/accounts/self/detail');
  const reviewLabelMaxValue = getLabelMaxValue(change, REVIEW_LABEL);

  if (currentUser.email !== change.owner.email &&
      !isLabelVotePermitted(change, REVIEW_LABEL,
          '+' + reviewLabelMaxValue)) {
    changeActions.removePrimaryActionKey(changeActions.ChangeActions.REVERT);
    changeActions.setActionOverflow(
        changeActions.ActionType.CHANGE,
        changeActions.ChangeActions.REVERT,
        true);
    changeActions.removePrimaryActionKey(_CUSTOM_RELAND_KEY);
    changeActions.setActionOverflow(
        changeActions.ActionType.CHANGE,
        _CUSTOM_RELAND_KEY,
        true);
  }
}

/**
 * Adds a "Reland" button to the page.
 * @param {Plugin} plugin: the plugin object
 * @param {ChangeInfo} change: the object for the current change
 * @param {ChangeActions} changeActions: the object that contains requested
 * action changes
 */
function installRelandButton(plugin, change, changeActions) {
  _CURR_CHANGE = change;
  _NEW_KEY = changeActions.add(
      changeActions.ActionType.CHANGE, 'Create Reland');
  changeActions.setEnabled(_NEW_KEY, true);
  const handler = async function() {
    if (_RELAND_POPUP) {
      // Make sure the popup is completely closed before we open it.
      _RELAND_POPUP.close();
      _RELAND_POPUP.open();
    } else {
      _RELAND_POPUP = await plugin.popup(RelandPopup.is);
    }
  }
  changeActions.addTapListener(_NEW_KEY, handler);
  _CUSTOM_RELAND_KEY = _NEW_KEY;
}

/**
 * createReland relands a change with a given notification level.
 * @param {Plugin} plugin: the plugin object
 * @param {string} notify: the notification level
 */
async function createReland(plugin, notify) {
  const changeActions = plugin.changeActions();
  changeActions.setEnabled(_NEW_KEY, false);
  changeActions.setLabel(_NEW_KEY, 'Reopening...');
  const orig = (
    _CURR_CHANGE.revisions[_CURR_CHANGE.current_revision].commit.message.trim());
  const subject = 'Reland "' + _CURR_CHANGE.subject + '"\n\n';
  const disclaimer = (
    'This is a reland of ' + _CURR_CHANGE.current_revision + '\n\n' +
      'Original change\'s description:\n');
  const quote = orig.replace(/^/gm, '> ').replace(/^> $/gm, '>');
  let message = subject + disclaimer + quote;
  const bugFooter = getTrailer(orig, 'Bug');
  const cqFooter = getTrailer(orig, 'Cq-Include-Trybots');
  if (bugFooter || cqFooter) {
    message += '\n\n' + bugFooter + cqFooter;
  }
  const url = (
    '/changes/' + _CURR_CHANGE._number + '/revisions/' +
    _CURR_CHANGE.revisions[_CURR_CHANGE.current_revision]._number +
      '/cherrypick');
  const body = {
    message: message.trim(),
    destination: _CURR_CHANGE.branch,
    notify: notify,
    keep_reviewers: true,
  };
  try {
    const response = await plugin.restApi().post(url, body);
    window.location.pathname = '/c/' + response._number;
  } catch (err) {
    changeActions.setLabel(_NEW_KEY, 'Can\'t reland');
    changeActions.setEnabled(_NEW_KEY, false);
    changeActions.ensureEl().dispatchEvent(new CustomEvent('show-alert', {
      detail: {message: 'Cannot reland: ' + err.message},
      composed: true,
      bubbles: true,
    }));
    throw err;
  }
}

class RelandPopup extends Polymer.Element {
  static get template() {
    return relandPopupTemplate;
  }

  static get is() {
    return 'reland-popup';
  }

  _handleConfirm() {
    this._createReland("ALL");
    _RELAND_POPUP.close();
  }

  _handleCancel() {
    this._createReland("OWNER");
    _RELAND_POPUP.close();
  }

  async _createReland(notify) {
    try {
      await createReland(this.plugin, notify);
    } catch (err) {
      console.error(err);
    }
  }
}

customElements.define(RelandPopup.is, RelandPopup);
