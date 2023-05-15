/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {
  ChangeInfo,
  ApprovalInfo,
} from '@gerritcodereview/typescript-api/rest-api';

import {
  REVIEW_LABEL,
  STATUS_SUBMITTED,
  getApprovalsForLabel,
  getLabelMaxValue,
} from './common';

const SELF_APPROVAL_MESSAGE =
  'WARNING: The owner of this change has voted on the Code-Review label. ' +
  'Self-approving a change is not allowed and might prevent it from being ' +
  'submitted.';

const WARNER_STYLES = `
.chromium-warner {
  margin: 5px;
  width: 20em;
}

.warning {
  color: red;
  font-weight: bold;
}`;

/**
 * Installs a warning under the change's metadata.
 *
 * @param element change-metadata-item
 *
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function warnerHook(element: any) {
  const change = element.change as ChangeInfo;

  // Remove any previous installations.
  for (const child of element.getElementsByClassName('chromium-warner')) {
    element.removeChild(child);
  }

  // Don't warn on submitted changes.
  if (change.status === STATUS_SUBMITTED) {
    return;
  }

  const maxValue = getLabelMaxValue(change, REVIEW_LABEL);
  const isSelfApproved = getApprovalsForLabel(change, REVIEW_LABEL).some(
    (vote: ApprovalInfo) =>
      vote.email === change.owner.email &&
      vote.value === maxValue &&
      !vote.tags?.includes('SERVICE_USER')
  );
  if (!isSelfApproved) {
    return;
  }

  // Style the element
  const style = document.createElement('style');
  style.textContent = WARNER_STYLES;
  const root = element.getRootNode();
  root.insertBefore(style, root.childNodes[0]);

  // Add the self-approval meessage.
  const container = document.createElement('div');
  container.className = 'chromium-warner';

  const icon = document.createElement('span');
  icon.className = 'warning';
  icon.textContent = '⚠ ';

  container.appendChild(icon);
  container.appendChild(document.createTextNode(SELF_APPROVAL_MESSAGE));

  element.appendChild(container);
}
