/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {PluginApi} from '@gerritcodereview/typescript-api/plugin';

import {
  ChangeInfo,
  ApprovalInfo,
} from '@gerritcodereview/typescript-api/rest-api';

import {LabelsChangedDetail} from '@gerritcodereview/typescript-api/change-reply';

import {
  REVIEW_LABEL,
  STATUS_SUBMITTED,
  getApprovalsForLabel,
  getChangeObj,
  getLabelMaxValue,
} from './common';

const SELF_APPROVAL_MESSAGE =
  'WARNING: The owner of this change has voted on the Code-Review label. ' +
  'Self-approving a change is not allowed and might prevent it from being ' +
  'submitted.';

const WARNER_STYLES = `
.container {
  margin: 5px;
  width: 20em;
}

.warning {
  color: red;
  font-weight: bold;
}`;

export function installSelfReviewWarner(plugin: PluginApi, change: ChangeInfo) {
  // Don't warn on submitted changes.
  if (change.status === STATUS_SUBMITTED) {
    return;
  }

  // Display a warning if the change is already self-approved.
  installOnSelfApproval(plugin, change);
}

export function installLabelValuesCallbackReviewWarner(plugin: PluginApi) {
  // After each label update, check again if the change has been self-approved.
  const replyApi = plugin.changeReply();
  replyApi.addLabelValuesChangedCallback(
    async (labelDetail: LabelsChangedDetail, change?: ChangeInfo) => {
      if (!change) {
        return;
      }
      // Only check again if the Code-Review label was just approved.
      const maxValue = `+${getLabelMaxValue(change, REVIEW_LABEL)}`;
      if (labelDetail.name !== REVIEW_LABEL || labelDetail.value !== maxValue) {
        return;
      }
      const refreshedChange = await getChangeObj(plugin, change);
      installOnSelfApproval(plugin, refreshedChange);
    }
  );
}

/**
 * Displays an alert if the change is approved by its owner.
 */
export function installOnSelfApproval(plugin: PluginApi, change: ChangeInfo) {
  const maxValue = getLabelMaxValue(change, REVIEW_LABEL);
  const isSelfApproved = getApprovalsForLabel(change, REVIEW_LABEL).some(
    (vote: ApprovalInfo) =>
      vote.email === change.owner.email &&
      vote.value === maxValue &&
      !vote.tags?.includes('SERVICE_USER')
  );
  if (isSelfApproved) {
    plugin.hook('change-metadata-item').onAttached(installWarner);
  }
}

/**
 * Installs a warning under the change's metadata.
 *
 * @param element change-metadata-item
 */
export function installWarner(element: HTMLElement) {
  // Remove any previous installations.
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  // Style the element
  const style = document.createElement('style');
  style.textContent = WARNER_STYLES;
  const root = element.getRootNode();
  root.insertBefore(style, root.childNodes[0]);

  // Add the self-approval meessage.
  const container = document.createElement('div');
  container.className = 'container';

  const icon = document.createElement('span');
  icon.className = 'warning';
  icon.textContent = '⚠ ';

  container.appendChild(icon);
  container.appendChild(document.createTextNode(SELF_APPROVAL_MESSAGE));

  element.appendChild(container);
}
