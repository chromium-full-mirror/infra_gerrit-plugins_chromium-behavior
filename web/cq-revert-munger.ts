/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {
  CQ_LABEL,
  REVIEW_LABEL,
  getChangeLabel,
  getLabelMaxValue,
  getTrailer,
  quoteOriginalMessage,
} from './common';

import {ChangeInfo} from '@gerritcodereview/typescript-api/rest-api';

const CQ_SPAN = document.createElement('span');
CQ_SPAN.style.margin = '8px';
CQ_SPAN.textContent = 'Automatically send revert change to CQ';

const CQ_CHECK = document.createElement('input');
CQ_CHECK.type = 'checkbox';
CQ_CHECK.style.marginLeft = '8px';
CQ_SPAN.appendChild(CQ_CHECK);

/**
 * Called when the confirm-revert-change element is added to the page.
 * Adds the cq checkbox to the confirm revert change dialog.
 *
 * @param element - the confirm-revert-change element.
 */
export function installCQCheckbox(element: HTMLElement) {
  // Add CQ checkbox to confirm-revert-dialog.
  element.style.display = 'block';
  element.appendChild(CQ_SPAN);
}

/**
 * Called when the user clicks the "Revert" button to pull up the dialog.
 *
 * @param change - the object for the current change
 * @param revertMsg - the default message Gerrit would use
 * @param originalMsg - the commit message of the original change
 * @returns used to populate the Revert dialog box
 */
export function cqInterceptRevertMessage(
  change: ChangeInfo,
  revertMsg: string,
  originalMsg: string
): string {
  const label = getChangeLabel(change, CQ_LABEL);
  if (!label) {
    CQ_SPAN.style.display = 'none';
    return revertMsg;
  }

  let newDescription = quoteOriginalMessage(revertMsg, originalMsg) + '\n\n';

  // Only add TBR= and skip CQ control trailers if the
  // reverted change is recent enough and it's not reland.
  const submittedDate = new Date(`${change.submitted} UTC`);
  const diffSeconds = (Date.now() - submittedDate.getTime()) / 1000;
  if (diffSeconds > 24 * 60 * 60) {
    alert(
      'Note: The CL will not be automatically sent to the CQ and ' +
        'the CQ checks will not be skipped because this CL landed ' +
        'more than 1 day ago.'
    );
    CQ_SPAN.style.display = 'none';
    newDescription +=
      '# Not skipping CQ checks because original CL ' +
      'landed > 1 day ago.\n\n';
  } else if (newDescription.startsWith('Reland "')) {
    alert(
      'Note: The CL will not be automatically sent to the CQ and ' +
        'the CQ checks will not be skipped because it is a reland ' +
        '(revert of a revert).'
    );
    CQ_SPAN.style.display = 'none';
    newDescription +=
      '# Not skipping CQ checks because this is a ' + 'reland.\n\n';
  } else {
    // Construct new TBR tag.
    let reviewers = (change.reviewers.REVIEWER || []).map(
      reviewer => reviewer.email
    );
    // Do not add Commit bots to TBR. See crbug.com/642739
    reviewers = reviewers.filter(
      email => email && !email.endsWith('commit-bot@chromium.org')
    );
    reviewers.push(change.owner.email);
    reviewers = Array.from(new Set(reviewers));

    newDescription +=
      'TBR=' +
      reviewers.join(',') +
      '\n' +
      '\n' +
      'No-Presubmit: true\n' +
      'No-Tree-Checks: true\n' +
      'No-Try: true\n';
  }

  // Carry over bug lines.
  newDescription += getTrailer(originalMsg, 'Bug');
  newDescription += getTrailer(originalMsg, 'Issue');
  // Carry over original trybots trailer.
  newDescription += getTrailer(originalMsg, 'Cq-Include-Trybots');

  return newDescription.trim();
}

/**
 * Called when the Revert action has been completed.
 *
 * @param change - the object representing the new revert
 * @returns the labels to set on the new revert
 */
export function cqApproveAndSubmitRevert(change: ChangeInfo) {
  const labels: {[k: string]: number} = {};
  // Auto-approve reverts.
  labels[REVIEW_LABEL] = getLabelMaxValue(change, REVIEW_LABEL);
  // Immediately send to CQ only if CQ_CHECK is checked.
  if (CQ_CHECK.checked) {
    labels[CQ_LABEL] = getLabelMaxValue(change, CQ_LABEL);
  }
  return labels;
}
