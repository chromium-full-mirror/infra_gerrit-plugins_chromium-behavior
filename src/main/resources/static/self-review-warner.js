// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  REVIEW_LABEL, getLabelMaxValue, getChangeLabel,
  getChangeObj} from './common.js';

const selfApprovalMsg =
  'WARNING: The owner of this change has voted on the Code-Review label.\n' +
  'Self-approving a change is not allowed and might prevent it from being ' +
  'submitted.';

export function installSelfReviewWarner(plugin, change) {
  // Display an alert if the change is already self-approved.
  alertOnSelfApproval(change);

  // After each label update, check again if the change has been self-approved.
  const replyApi = plugin.changeReply();
  replyApi.addLabelValuesChangedCallback(({name, value}) => {
    // Only check again if the Code-Review label was just approved.
    const maxValue = '+' + getLabelMaxValue(change, REVIEW_LABEL);
    if (name !== REVIEW_LABEL || value !== maxValue) {
      return;
    }
    getChangeObj(plugin).then((refreshedChange) => {
      alertOnSelfApproval(refreshedChange);
    });
  });
}

/**
 * Displays an alert if the change is approved by its owner.
 * @param {object} change gr-change-view
 */
function alertOnSelfApproval(change) {
  const maxValue = getLabelMaxValue(change, REVIEW_LABEL);
  const isSelfApproved = getChangeLabel(change, REVIEW_LABEL).all.some(
    (vote) => vote.email === change.owner.email && vote.value === maxValue);
  if (isSelfApproved) {
    alert(selfApprovalMsg);
  }
}
