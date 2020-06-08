// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {REVIEW_LABEL} from './common.js';

const _TBR_REGEX = /^\s*(TBR=|Tbr:).*$/mg;

/**
 * Warns the user that just adding TBR= to a commit message isn't enough.
 * @param {ChangeInfo} change: the object for the current change
 * @param {string} message: the newly-set commit message
 */
export function warnAboutTbr(change, message) {
  let match = _TBR_REGEX.exec(message);
  if (match && change.labels[REVIEW_LABEL] &&
      change.labels[REVIEW_LABEL].approved == null) {
    alert('You have added a TBR line. You must also approve ' +
          'this change for it to be submittable.');
  }
};
