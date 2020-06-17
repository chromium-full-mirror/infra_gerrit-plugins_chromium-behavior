// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {CQ_LABEL, getLabelMaxValue, getTrailer, REVIEW_LABEL} from './common.js';

// A CQ checkbox for options to send revert immediately to CQ.
const CQ_INPUT_STYLES = {
  styleSpan: 'margin: 8px;',
  styleCheck: 'margin-left: 8px;',
  styleBlock: 'display: block;',
  styleHidden: 'display: none;',
}

const CQ_SPAN = document.createElement('span');
CQ_SPAN.style = CQ_INPUT_STYLES.styleSpan;
CQ_SPAN.textContent = 'Automatically send revert change to CQ';

const CQ_CHECK = document.createElement('input');
CQ_CHECK.type = 'checkbox';
CQ_CHECK.style = CQ_INPUT_STYLES.styleCheck;
CQ_SPAN.appendChild(CQ_CHECK);

/**
 * Called when the confirm-revert-change element is added to the page.
 * Adds the cq checkbox to the confirm revert change dialog.
 * @param {element} element: the confirm-revert-change element.
 */
export function installCQCheckbox(element) {
  // Add CQ checkbox to confirm-revert-dialog.
  element.style = CQ_INPUT_STYLES.styleBlock;
  element.appendChild(CQ_SPAN);
}

/**
 * Called when the user clicks the "Revert" button to pull up the dialog.
 * @param {ChangeInfo} change: the object for the current change
 * @param {string} revertMsg: the default message Gerrit would use
 * @param {string} originalMsg: the commit message of the original change
 * @returns {string} used to populate the Revert dialog box
 */
export function interceptRevertMessage(change, revertMsg, originalMsg) {
  if (!change.labels[CQ_LABEL]) {
    CQ_SPAN.style = CQ_INPUT_STYLES.styleHidden;
    return revertMsg;
  }
  // Add email-style quoting ('> ') in front of the original commit text.
  let originalCommitText = originalMsg.trim().replace(/^/gm, '> ');

  // Start constructing the revert change description.

  // Show reverts-of-reverts as relands instead.
  let originalRevertMsg = revertMsg;
  revertMsg = revertMsg.replace(
      /^Revert "Revert "(.*)""/, 'Reland "$1"');

  let isReland = (originalRevertMsg !== revertMsg);

  let newDescription =
      revertMsg + '\n' +
      'Original change\'s description:\n' + originalCommitText + '\n\n';

  // Construct new Bug: trailer.
  let bugLine = getTrailer(originalMsg, 'Bug');
  bugLine += getTrailer(originalMsg, 'Issue');

  // CrOS projects need only the bug line carried over.
  if (change.project.indexOf('chromiumos/') === 0 ||
      change.project.indexOf('chromeos/') === 0) {
    newDescription += bugLine;
    return newDescription.trim();
  }

  // Construct new TBR tag.
  let reviewers = [];
  if (change.reviewers.REVIEWER) {
    reviewers = change.reviewers.REVIEWER.map(function(reviewer) {
      return reviewer.email;
    });
  }
  reviewers = reviewers.filter(function(email) {
    // Do not add Commit bots to TBR. See crbug.com/642739
    return email && !email.endsWith('commit-bot@chromium.org');
  });
  reviewers.push(change.owner.email);
  reviewers = reviewers.filter(function(item, pos, self) {
    return self.indexOf(item) === pos;
  });
  let tbrLine = 'TBR=' + reviewers.join(',') + '\n\n';
  newDescription += tbrLine;

  // Carry over original trybots trailer.
  let includeLine = getTrailer(originalMsg, 'Cq-Include-Trybots');

  let submittedDate = new Date(change.submitted + ' UTC');
  let diffSeconds = (Date.now() - submittedDate) / 1000;
  if (diffSeconds > 24 * 60 * 60) {
    alert('Note: The CL will not be automatically sent to the CQ and ' +
          'the CQ checks will not be skipped because this CL landed ' +
          'more than 1 day ago.');
    CQ_SPAN.style = CQ_INPUT_STYLES.styleHidden;
    newDescription += '# Not skipping CQ checks because original CL ' +
                      'landed > 1 day ago.\n\n';
  } else if (isReland) {
    alert('Note: The CL will not be automatically sent to the CQ and ' +
          'the CQ checks will not be skipped because it is a reland ' +
          '(revert of a revert).');
    CQ_SPAN.style = CQ_INPUT_STYLES.styleHidden;
    newDescription += '# Not skipping CQ checks because this is a ' +
                      'reland.\n\n';
  } else {
    // https://crbug.com/1075741 Only include CQ control trailers if the
    // reverted change is recent enough and it's not reland.
    newDescription += 'No-Presubmit: true\nNo-Tree-Checks: true\n' +
                      'No-Try: true\n';
  }

  // Add previously-constructed trailers.
  newDescription += bugLine;
  newDescription += includeLine;

  return newDescription.trim();
}

/**
 * Called when the Revert action has been completed.
 * @param {ChangeInfo} change: the object representing the new revert
 * @returns {LabelInfo} the labels to set on the new revert
 */
export function approveAndSubmitRevert(change) {
  let labels = {};
  // Auto-approve reverts.
  labels[REVIEW_LABEL] = getLabelMaxValue(change, REVIEW_LABEL);
  // Immediately send to CQ only if CQ_CHECK is checked.
  if (CQ_CHECK.checked) {
    labels[CQ_LABEL] = getLabelMaxValue(change, CQ_LABEL);
  }
  return labels;
}
