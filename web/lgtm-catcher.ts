/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {ChangeReplyPluginApi} from '@gerritcodereview/typescript-api/change-reply';

import {REVIEW_LABEL} from './common';

const LGTM = 'lgtm';

export function installLgtmWatcher(replyApi: ChangeReplyPluginApi) {
  let autoAdded = false;

  replyApi.addReplyTextChangedCallback((text: string) => {
    const labelValue = replyApi.getLabelValue(REVIEW_LABEL);
    if (!labelValue) {
      return;
    }
    if (
      labelValue === ' 0' &&
      autoAdded === false &&
      text.trim().toLowerCase().indexOf(LGTM) === 0
    ) {
      autoAdded = true;
      replyApi.setLabelValue(REVIEW_LABEL, '+1');
    } else if (
      labelValue === '+1' &&
      autoAdded === true &&
      text.trim().toLowerCase().indexOf(LGTM) !== 0
    ) {
      autoAdded = false;
      replyApi.setLabelValue(REVIEW_LABEL, ' 0');
    }
  });
}
