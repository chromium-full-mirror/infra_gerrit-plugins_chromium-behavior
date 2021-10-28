/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {
  ChangeInfo,
  isQuickLabelInfo,
} from '@gerritcodereview/typescript-api/rest-api';

import {REVIEW_LABEL, getChangeLabel} from './common';

const _TBR_REGEX = /^\s*(TBR=|Tbr:).*$/gm;

/**
 * Warns the user that just adding TBR= to a commit message isn't enough.
 *
 * @param change - the object for the current change
 * @param message- the newly-set commit message
 */
export function warnAboutTbr(change: ChangeInfo, message: string) {
  const match = _TBR_REGEX.exec(message);
  const label = getChangeLabel(change, REVIEW_LABEL);
  let approved = false;
  if (label && isQuickLabelInfo(label)) {
    approved = label.approved !== null;
  }
  if (match && !approved) {
    alert(
      'You have added a TBR line. You must also approve ' +
        'this change for it to be submittable.'
    );
  }
}
