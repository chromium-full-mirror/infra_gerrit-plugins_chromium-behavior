// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {CQ_LABEL, REVIEW_LABEL, STATUS_SUBMITTED, getChangeDrafts,
  getChangeLabel, getChangeObj, getLabelMaxValue,
  isLabelVotePermitted} from './common.js';

import {autosubmitPopupTemplate} from './autosubmit-popup-html.js';

const AS_LABEL_MAX_VALUE = 1;
const AUTOSUBMIT_LABEL = 'Auto-Submit';

let AUTOSUBMIT_POPUP = null;
let CUSTOM_QUICK_APPROVE_KEY = null;
let REVIEW_LABEL_MAX_VALUE = 0;
let CQ_LABEL_MAX_VALUE = 0;
let APPROVED_BY_ALL_OTHER_REVIEWERS = false;

/**
 * There are two main flows that need to handle the AS+1 vote:
 * 1. CR+1 in reply dialog should automatically set CQ+2 label without
 *    submitting. An info msg should be displayed to the user in the dialog.
 * 2. CR+1 button on the main page should display a popup asking if CQ+2
 *    should be set since AS+1 is set.
 *
 * This function adds both behaviors. See crbug.com/631551 for more context.
 */
export function installAutoSubmit(plugin, change) {
  if (!change || !change.permitted_labels) {
    // Could happen if the user is not logged in.
    return;
  }
  if (change.status === STATUS_SUBMITTED) {
    // Do not need autosubmit behavior for already submitted changes.
    return;
  }

  // Save the change's CR and CQ label max values for easy access from
  // different functions.
  REVIEW_LABEL_MAX_VALUE = getLabelMaxValue(change, REVIEW_LABEL);
  CQ_LABEL_MAX_VALUE = getLabelMaxValue(change, CQ_LABEL);

  if (REVIEW_LABEL_MAX_VALUE === 0 || CQ_LABEL_MAX_VALUE === 0 ||
      getLabelMaxValue(change, AUTOSUBMIT_LABEL) !== AS_LABEL_MAX_VALUE) {
    // Exit early if project does not have the expected labels with expected
    // max values.
    return;
  }

  if (!isLabelVotePermitted(change, CQ_LABEL, '+' + CQ_LABEL_MAX_VALUE) ||
      !isLabelVotePermitted(change, REVIEW_LABEL,
          '+' + REVIEW_LABEL_MAX_VALUE)) {
    // Exit early if user does not have necessary permissions to CR+1
    // and CQ+2.
    return;
  }

  // Check to see if we are still waiting for any other reviewers to
  // approve.
  checkIfApprovedByAllOtherReviewers(plugin, change);

  // Watch for any label value changes to see if CQ+2 should be
  // automatically added.
  const replyApi = plugin.changeReply();
  replyApi.addLabelValuesChangedCallback(
      labelValuesCallback(plugin, replyApi, change));

  // Replace the CR+1 button with a custom handler on the main page.
  replaceQuickApproveButton(plugin, change);
}

/**
 * Checks to see if any reviewer, other than the current user and the
 * change owner, has not approved the change yet. Updates the
 * APPROVED_BY_ALL_OTHER_REVIEWERS global var with the result.
 */
async function checkIfApprovedByAllOtherReviewers(plugin, change) {
  if (change.reviewers && change.reviewers.REVIEWER &&
      change.labels[REVIEW_LABEL].all) {
    // Gather account_emails of all approvers.
    const approverEmails = [];
    for (let i=0; i<change.labels[REVIEW_LABEL].all.length; i++) {
      if (change.labels[REVIEW_LABEL].all[i].value ===
          REVIEW_LABEL_MAX_VALUE) {
        approverEmails.push(change.labels[REVIEW_LABEL].all[i].email);
      }
    }
    // Get the account_email of the current user and use that to determine
    // if any other reviewer has not approved the change yet.
    try {
      const resp = await plugin.restApi().get('/accounts/self/detail');
      let approvedByAllOtherReviewers = true;
      const currentUserEmail = resp.email;
      // Check to see if any reviewer, other than the current user and the
      // change owner, has not approved the change yet.
      for (let i=0; i<change.reviewers.REVIEWER.length; i++) {
        const reviewerEmail = change.reviewers.REVIEWER[i].email;
        if (reviewerEmail != currentUserEmail &&
            reviewerEmail != change.owner.email &&
            !approverEmails.includes(reviewerEmail)) {
          approvedByAllOtherReviewers = false;
          break;
        }
      }
      APPROVED_BY_ALL_OTHER_REVIEWERS = approvedByAllOtherReviewers;
    } catch (err) {
      const changeActions = plugin.changeActions();
      changeActions.ensureEl().dispatchEvent(new CustomEvent('show-alert',
          {detail: {message: err}, bubbles: true}));
      throw err;
    }
  }
}

/**
 * Sets CR+1 and optionally CQ+2 on the current change.
 * @param {bool} sendToCQ: Whether the change should also be sent to the CQ.
 * @returns {promise} Promise from the POST call.
 */
async function setApprovalLabels(plugin, change, sendToCQ) {
  // TODO(rmistry): Add getChangeNum to GrChangeActionsInterface?
  const url = `/changes/${change._number}/revisions/current/review`;
  const body = {labels: {}};
  body['labels'][REVIEW_LABEL] = '+' + REVIEW_LABEL_MAX_VALUE;
  body['drafts'] = 'PUBLISH';
  if (sendToCQ) {
    body['labels'][CQ_LABEL] = '+' + CQ_LABEL_MAX_VALUE;
  }
  const changeActions = plugin.changeActions();
  try {
    await plugin.restApi().post(url, body);
    // TODO(http://crbug.com/gerrit/6689): Use real plugin API to reload
    // change when available.
    changeActions.ensureEl().dispatchEvent(new CustomEvent(
        'reload', {bubbles: false, composed: true}));
  } catch (err) {
    changeActions.ensureEl().dispatchEvent(new CustomEvent('show-alert',
        {detail: {message: err}, bubbles: true}));
    throw err;
  }
}

/**
 * This is the callback used when label values change. Labels can change
 * from either the reply dialog box or by 'x'ing labels on the main page.
 * There is no page reload when labels change.
 *
 * Algorithm used by the callback:
 *
 *   ownerDeselectedAutoSubmit = false
 *
 *   If label name == Code-Review:
 *     Re-evaluate the quick approve button
 *     If CR+1 and AS+1 and not ownerDeselectedAutoSubmit:
 *       Set CQ+2
 *       Inform user that CQ+2 was automatically set
 *   If label name == Auto-Submit:
 *     Set ownerDeselectedAutoSubmit value
 *     If CR+1 and not ownerDeselectedAutoSubmit:
 *       Set CQ+2
 *       Inform user that CQ+2 was automatically set
 */
function labelValuesCallback(plugin, replyApi, change) {
  let ownerDeselectedAutoSubmit = false;
  return async function({name, value}) {
    const reviewApproved = replyApi.getLabelValue(REVIEW_LABEL) ===
                               '+' + REVIEW_LABEL_MAX_VALUE;
    const autoSubmitApproved = isAutoSubmitApproved(change, replyApi);
    replyApi.showMessage('');

    if (name === REVIEW_LABEL) {
      // Always re-evaluate the quick approve button when Code-Review label
      // changes. Get the latest change object from the server to be sure we
      // are making the right decisions when displaying the quick approve
      // button (see crbug.com/820117).
      const refreshedChangeObj = await getChangeObj(plugin, change);
      replaceQuickApproveButton(plugin, refreshedChangeObj);
      // If CR+1 and AS+1 then set CQ+2 if there are no unresolved
      // comments and/or drafts.
      if (value === '+' + REVIEW_LABEL_MAX_VALUE && autoSubmitApproved &&
          !ownerDeselectedAutoSubmit) {
        const unresolvedMsg = 'This change has unresolved comments ' +
                               'and/or drafts. Not triggering ' +
                               'AutoSubmit.';
        if (refreshedChangeObj.unresolved_comment_count !== 0) {
          replyApi.showMessage(unresolvedMsg);
        } else {
          const drafts = await getChangeDrafts(plugin, change);
          if (Object.keys(drafts).length === 0) {
            replyApi.setLabelValue(CQ_LABEL, '+' + CQ_LABEL_MAX_VALUE);
            replyApi.showMessage(getSendToCQReplyDialogMsg());
          } else {
            replyApi.showMessage(unresolvedMsg);
          }
        }
      }
    } else if (name === AUTOSUBMIT_LABEL) {
      // The change owner has changed the vote of the Auto-Submit label.
      ownerDeselectedAutoSubmit = (value !== '+' + AS_LABEL_MAX_VALUE);
      if (!ownerDeselectedAutoSubmit && reviewApproved) {
        // If AS+1 and CR+1 then set CQ+2.
        replyApi.setLabelValue(CQ_LABEL, '+' + CQ_LABEL_MAX_VALUE);
        replyApi.showMessage(getSendToCQReplyDialogMsg());
      }
    }
  };
}

/**
 * Returns the autosubmit msg that should be displayed in the reply dialog.
 */
function getSendToCQReplyDialogMsg() {
  let sendToCQMsg = 'This change\'s owner has enabled Auto-Submit. ' +
                    'Your approval will also set CQ+' +
                    CQ_LABEL_MAX_VALUE +
                    '. Unselect that if you don\'t want to trigger it.';
  if (!APPROVED_BY_ALL_OTHER_REVIEWERS) {
    sendToCQMsg += '\nNote: Not all reviewers have approved this change!';
  }
  return sendToCQMsg;
}

/**
 * Looks at both the replyApi and the change object to determine if
 * AS+1 is set. This checks the replyApi for the case where the owner sets
 * their own AS+1 and CR+1 at the same time. In that case we want to also
 * go ahead and set CQ+1.
 */
function isAutoSubmitApproved(change, replyApi) {
  return (replyApi.getLabelValue(AUTOSUBMIT_LABEL) ===
              '+' + AS_LABEL_MAX_VALUE ||
          getChangeLabel(change, AUTOSUBMIT_LABEL).approved);
}

/**
 * This function replaces the quick approve button with a new button with
 * a custom handler that prompts if AS+1 is set.
 */
async function replaceQuickApproveButton(plugin, change) {
  const changeActions = plugin.changeActions();

  // Make sure the old quick approve button is hidden.
  changeActions.hideQuickApproveAction();

  try {
    const resp = await plugin.restApi().get('/accounts/self/detail');
    // See if the current user has approved the change.
    let approvedByCurrentUser = false;
    if (change.labels[REVIEW_LABEL].all) {
      for (let i=0; i<change.labels[REVIEW_LABEL].all.length; i++) {
        if (change.labels[REVIEW_LABEL].all[i].value ===
            REVIEW_LABEL_MAX_VALUE) {
          if (resp._account_id ==
              change.labels[REVIEW_LABEL].all[i]._account_id) {
            approvedByCurrentUser = true;
            break;
          }
        }
      }
    }

    if (getChangeLabel(change, REVIEW_LABEL).approved &&
        approvedByCurrentUser) {
      if (CUSTOM_QUICK_APPROVE_KEY !== null) {
        // The custom button is visible but should be now removed because
        // the user set CR+1.
        changeActions.remove(CUSTOM_QUICK_APPROVE_KEY);
        changeActions.removeTapListener(CUSTOM_QUICK_APPROVE_KEY);
        CUSTOM_QUICK_APPROVE_KEY = null;
      }
      // Do not create a new button because this user already set CR+1.
      return;
    } else if (CUSTOM_QUICK_APPROVE_KEY !== null) {
      // There is already a button no need to create a new one.
      return;
    }

    // Create the custom quick approve button.
    const key = changeActions.add(
        changeActions.ActionType.CHANGE,
        'Code-Review+' + REVIEW_LABEL_MAX_VALUE);
    changeActions.setEnabled(key, true);
    changeActions.addTapListener(
        key, quickApproveHandler(plugin, change, changeActions, key));
    changeActions.setActionPriority(
        changeActions.ActionType.CHANGE, key, -3);
    CUSTOM_QUICK_APPROVE_KEY = key;
  } catch (err) {
    const changeActions = plugin.changeActions();
    changeActions.ensureEl().dispatchEvent(new CustomEvent('show-alert',
        {detail: {message: err}, bubbles: true}));
    throw err;
  }
}

function quickApproveHandler(plugin, change, changeActions, key) {
  return async function() {
    const refreshedChangeObj = await getChangeObj(plugin, change);
    // Disable the auto approve button.
    changeActions.setEnabled(key, false);
    if (!getChangeLabel(refreshedChangeObj, AUTOSUBMIT_LABEL).approved ||
        getChangeLabel(refreshedChangeObj, CQ_LABEL).approved) {
      // Do not automatically set CQ+2 if AS+1 is not set or if CQ+2
      // is already set.
      try {
        await setApprovalLabels(plugin, change, false);
      } catch (err) {
        console.log(err);
        // Re-enable the quick approve button if there was an error.
        changeActions.setEnabled(key, true);
      }
    } else {
      await openAutosubmitPopup(plugin, change);
      // Re-enable the key in case the user clicks outside the popup.
      changeActions.setEnabled(key, true);
    }
  };
}

async function openAutosubmitPopup(plugin, change) {
  if (AUTOSUBMIT_POPUP) {
    // Make sure the popup is completely closed before we open it.
    AUTOSUBMIT_POPUP.close();
    AUTOSUBMIT_POPUP.open();
  } else {
    AUTOSUBMIT_POPUP = await plugin.popup(AutosubmitPopup.is);
    const el = AUTOSUBMIT_POPUP._getElement().querySelector(AutosubmitPopup.is);
    el.change = change;
    el.init();
  }
}

class AutosubmitPopup extends Polymer.Element {
  static get template() {
    return autosubmitPopupTemplate;
  }

  static get is() {
    return 'autosubmit-popup';
  }

  static get properties() {
    return {
      unresolvedCommentsOrDrafts: Boolean,
    };
  }

  init() {
    this._setUnresolvedCommentsOrDrafts();
  }

  _handleConfirm() {
    this._setApprovalLabels(true);
    AUTOSUBMIT_POPUP.close();
  }

  _handleCancel() {
    this._setApprovalLabels(false);
    AUTOSUBMIT_POPUP.close();
  }

  async _setApprovalLabels(sendToCQ) {
    try {
      await setApprovalLabels(this.plugin, this.change, sendToCQ);
    } catch (err) {
      // Re-enable the quick approve button if there was an error.
      console.error(err);
      this.plugin.changeActions().setEnabled(CUSTOM_QUICK_APPROVE_KEY, true);
    }
  }

  _isApprovedByAllOtherReviewers() {
    return APPROVED_BY_ALL_OTHER_REVIEWERS;
  }

  async _setUnresolvedCommentsOrDrafts() {
    const change = await getChangeObj(this.plugin, this.change);
    if (change.unresolved_comment_count !== 0) {
      this.unresolvedCommentsOrDrafts = true;
      return;
    }
    const drafts = await getChangeDrafts(this.plugin, this.change);
    this.unresolvedCommentsOrDrafts = Object.keys(drafts).length !== 0;
  }
}

customElements.define(AutosubmitPopup.is, AutosubmitPopup);
