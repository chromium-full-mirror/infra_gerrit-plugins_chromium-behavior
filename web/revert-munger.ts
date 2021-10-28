/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {ChangeInfo} from '@gerritcodereview/typescript-api/rest-api';

import {
  AS_LABEL,
  getChangeLabel,
  getLabelMaxValue,
  getTrailer,
  quoteOriginalMessage,
} from './common';

const AS_SPAN = document.createElement('span');
AS_SPAN.style.margin = '8px';
AS_SPAN.textContent = 'Send CL to CQ automatically after approval';

const AS_CHECK = document.createElement('input');
AS_CHECK.type = 'checkbox';
AS_CHECK.style.marginLeft = '8px';
AS_SPAN.appendChild(AS_CHECK);

const _RUBBER_STAMPER = 'rubber-stamper@appspot.gserviceaccount.com';

/**
 * Called when the confirm-revert-change element is added to the page.
 * Adds the cq checkbox to the confirm revert change dialog.
 *
 * @param element - the confirm-revert-change element.
 */
export function installASCheckbox(element: HTMLElement) {
  // Add AS checkbox to confirm-revert-dialog.
  element.style.display = 'block';
  element.appendChild(AS_SPAN);
}

/**
 * Called when the user clicks the "Revert" button to pull up the dialog.
 *
 * @param change - the object for the current change
 * @param revertMsg - the default message Gerrit would use
 * @param originalMsg - the commit message of the original change
 * @returns used to populate the Revert dialog box
 */
export function interceptRevertMessage(
  change: ChangeInfo,
  revertMsg: string,
  originalMsg: string
) {
  if (!getChangeLabel(change, AS_LABEL)) {
    AS_SPAN.style.display = 'none';
  }

  let newDescription = quoteOriginalMessage(revertMsg, originalMsg) + '\n\n';

  // Carry over bug lines.
  newDescription += getTrailer(originalMsg, 'Bug');
  newDescription += getTrailer(originalMsg, 'Issue');

  // CrOS projects need only the bug line carried over.
  if (
    change.project.indexOf('chromiumos/') === 0 ||
    change.project.indexOf('chromeos/') === 0
  ) {
    return newDescription.trim();
  }

  // Carry over original trybots trailer.
  newDescription += getTrailer(originalMsg, 'Cq-Include-Trybots');

  // Add skip CQ control trailers if the reverted change is recent enough and
  // it's not reland.
  const submittedDate = new Date(`${change.submitted} UTC`);
  const diffSeconds = (Date.now() - submittedDate.getTime()) / 1000;
  if (diffSeconds > 24 * 60 * 60) {
    alert(
      'Note: CQ checks will not be skipped because this CL landed ' +
        'more than 1 day ago.'
    );
    AS_SPAN.style.display = 'none';
  } else if (newDescription.startsWith('Reland "')) {
    alert(
      'Note: CQ checks will not be skipped because it is a reland ' +
        '(revert of a revert).'
    );
    AS_SPAN.style.display = 'none';
  } else {
    newDescription +=
      'No-Presubmit: true\n' + 'No-Tree-Checks: true\n' + 'No-Try: true\n';
  }

  return newDescription.trim();
}

/**
 * Called when the Revert action has been completed.
 */
export function approveAndSubmitRevert(change: ChangeInfo) {
  const review: {
    reviewers: [{reviewer: string}];
    labels: {[k: string]: number};
  } = {
    reviewers: [{reviewer: _RUBBER_STAMPER}],
    labels: {},
  };
  // Set Auto-Submit+1 only if AS_CHECK is checked.
  if (AS_CHECK.checked) {
    review.labels[AS_LABEL] = getLabelMaxValue(change, AS_LABEL);
  }
  return review;
}
