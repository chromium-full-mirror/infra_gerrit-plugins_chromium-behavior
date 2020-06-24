// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {REVIEW_LABEL, STATUS_SUBMITTED, getLabelMaxValue, getTrailer,
  isLabelVotePermitted} from './common.js';

let _CUSTOM_RELAND_KEY = null;

/**
 * Adds a "Reland" button to the page if appropriate.
 * @param {Plugin} plugin: the plugin object
 * @param {ChangeInfo} change: the object for the current change
 */
export async function maybeInstallReland(plugin, change) {
  if (change.status !== STATUS_SUBMITTED) { return; }

  let changeActions = plugin.changeActions();

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
    changeActions.setActionOverflow(changeActions.ActionType.CHANGE,
                                    changeActions.ChangeActions.REVERT,
                                    true);
    changeActions.removePrimaryActionKey(_CUSTOM_RELAND_KEY);
    changeActions.setActionOverflow(changeActions.ActionType.CHANGE,
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
  let newKey = changeActions.add(changeActions.ActionType.CHANGE, 'Reland');
  changeActions.setEnabled(newKey, true);
  const handler = async function() {
    changeActions.setEnabled(newKey, false);
    changeActions.setLabel(newKey, 'Reopening...');
    let orig = (
        change.revisions[change.current_revision].commit.message.trim());
    let subject = 'Reland "' + change.subject + '"\n\n';
    let disclaimer = (
        'This is a reland of ' + change.current_revision + '\n\n' +
        'Original change\'s description:\n');
    let quote = orig.replace(/^/gm, '> ');
    let message = subject + disclaimer + quote;
    let bugFooter = getTrailer(orig, 'Bug');
    let cqFooter = getTrailer(orig, 'Cq-Include-Trybots');
    if (bugFooter || cqFooter) {
      message += '\n\n' + bugFooter + cqFooter;
    }
    let url = (
        '/changes/' + change._number + '/revisions/' +
        change.revisions[change.current_revision]._number +
        '/cherrypick');
    let body = {
      message: message.trim(),
      destination: change.branch,
      keep_reviewers: true,
    };
    try {
      const response = await plugin.restApi().post(url, body);
      window.location.pathname = '/c/' + response._number;
    } catch (err) {
      changeActions.setLabel(newKey, 'Can\'t reland');
      changeActions.setEnabled(newKey, false);
      changeActions._el.dispatchEvent(new CustomEvent('show-alert', {
        detail: {message: 'Cannot reland: ' + err},
        composed: true,
        bubbles: true,
      }));
      throw err;
    }
  }
  changeActions.addTapListener(newKey, handler);
  _CUSTOM_RELAND_KEY = newKey;
}
