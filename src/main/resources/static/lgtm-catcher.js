// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {REVIEW_LABEL} from './common.js';

const LGTM = 'lgtm';

export function installLgtmWatcher(replyApi) {
  let autoAdded = false;

  replyApi.addReplyTextChangedCallback(text => {
    const labelValue = replyApi.getLabelValue(REVIEW_LABEL);
    if (!labelValue) {
      return;
    }
    if (labelValue === ' 0' && autoAdded === false &&
        text.trim().toLowerCase().indexOf(LGTM) === 0) {
      autoAdded = true;
      replyApi.setLabelValue(REVIEW_LABEL, '+1');
    } else if (labelValue === '+1' && autoAdded === true &&
        text.trim().toLowerCase().indexOf(LGTM) !== 0) {
      autoAdded = false;
      replyApi.setLabelValue(REVIEW_LABEL, ' 0');
    }
  });
}
