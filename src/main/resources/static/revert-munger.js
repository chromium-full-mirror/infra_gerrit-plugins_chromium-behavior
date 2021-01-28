// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {AS_LABEL, getLabelMaxValue, getTrailer,
  quoteOriginalMessage} from './common.js';

// A AS checkbox for options to send revert to CQ once opproved.
const AS_INPUT_STYLES = {
  styleSpan: 'margin: 8px;',
  styleCheck: 'margin-left: 8px;',
  styleBlock: 'display: block;',
  styleHidden: 'display: none;',
};

const AS_SPAN = document.createElement('span');
AS_SPAN.style = AS_INPUT_STYLES.styleSpan;
AS_SPAN.textContent = 'Send CL to CQ automatically after approval';

const AS_CHECK = document.createElement('input');
AS_CHECK.type = 'checkbox';
AS_CHECK.style = AS_INPUT_STYLES.styleCheck;
AS_SPAN.appendChild(AS_CHECK);

const _RUBBER_STAMPER = 'rubber-stamper@appspot.gserviceaccount.com';

/**
 * Called when the confirm-revert-change element is added to the page.
 * Adds the cq checkbox to the confirm revert change dialog.
 * @param {element} element: the confirm-revert-change element.
 */
export function installASCheckbox(element) {
  // Add AS checkbox to confirm-revert-dialog.
  element.style = AS_INPUT_STYLES.styleBlock;
  element.appendChild(AS_SPAN);
}

/**
 * Called when the user clicks the "Revert" button to pull up the dialog.
 * @param {ChangeInfo} change: the object for the current change
 * @param {string} revertMsg: the default message Gerrit would use
 * @param {string} originalMsg: the commit message of the original change
 * @returns {string} used to populate the Revert dialog box
 */
export function interceptRevertMessage(change, revertMsg, originalMsg) {
  if (!change.labels[AS_LABEL]) {
    AS_SPAN.style = AS_INPUT_STYLES.styleHidden;
  }

  let newDescription = quoteOriginalMessage(revertMsg, originalMsg) + '\n\n';

  // Carry over bug lines.
  newDescription += getTrailer(originalMsg, 'Bug');
  newDescription += getTrailer(originalMsg, 'Issue');

  // CrOS projects need only the bug line carried over.
  if (change.project.indexOf('chromiumos/') === 0 ||
      change.project.indexOf('chromeos/') === 0) {
    return newDescription.trim();
  }

  // Carry over original trybots trailer.
  newDescription += getTrailer(originalMsg, 'Cq-Include-Trybots');

  // Add skip CQ control trailers if the reverted change is recent enough and
  // it's not reland.
  const submittedDate = new Date(change.submitted + ' UTC');
  const diffSeconds = (Date.now() - submittedDate) / 1000;
  if (diffSeconds > 24 * 60 * 60) {
    alert('Note: CQ checks will not be skipped because this CL landed ' +
          'more than 1 day ago.');
    AS_SPAN.style = AS_INPUT_STYLES.styleHidden;
  } else if (newDescription.startsWith('Reland "')) {
    alert('Note: CQ checks will not be skipped because it is a reland ' +
          '(revert of a revert).');
    AS_SPAN.style = AS_INPUT_STYLES.styleHidden;
  } else {
    newDescription += 'No-Presubmit: true\n' +
                      'No-Tree-Checks: true\n' +
                      'No-Try: true\n';
  }

  return newDescription.trim();
}

/**
 * Called when the Revert action has been completed.
 * @param {ChangeInfo} change: the object representing the new revert
 * @returns {LabelInfo} the labels to set on the new revert
 */
export function approveAndSubmitRevert(change) {
  const review = {
    reviewers: [
      {reviewer: _RUBBER_STAMPER},
    ],
    labels: {},
  };
  // Set Auto-Submit+1 only if AS_CHECK is checked.
  if (AS_CHECK.checked) {
    review.labels[AS_LABEL] = getLabelMaxValue(change, AS_LABEL);
  }
  return review;
}
