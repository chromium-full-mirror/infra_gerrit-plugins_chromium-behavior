/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import '@gerritcodereview/typescript-api/gerrit';

import {EventType, PluginApi} from '@gerritcodereview/typescript-api/plugin';
import {ChangeInfo} from '@gerritcodereview/typescript-api/rest-api';

import {ChopsBanner} from './chops-banner';
import {
  approveAndSubmitRevert,
  installASCheckbox,
  interceptRevertMessage,
} from './revert-munger';
import {
  cqApproveAndSubmitRevert,
  installCQCheckbox,
  cqInterceptRevertMessage,
} from './cq-revert-munger';
import {hideMoveChange} from './hide-move-change';
import {
  installAutoSubmit,
  installLabelValuesCallbackAutosubmit,
} from './autosubmit';
import {installLgtmWatcher} from './lgtm-catcher';
import {maybeInstallReland} from './reland-button';
import {warnAboutTbr} from './tbr-warner';
import {
  installSelfReviewWarner,
  installLabelValuesCallbackReviewWarner,
} from './self-review-warner';

window.Gerrit.install((plugin: PluginApi) => {
  const replyApi = plugin.changeReply();
  plugin.hook('banner').onAttached((el: HTMLElement) => {
    try {
      new ChopsBanner(window.location.host, el);
    } catch (e) {
      console.warn(e);
    }
  });

  const rubberStamperHosts = [
    'canary-chrome-internal-review.googlesource.com',
    'canary-chromium-review.googlesource.com',
    'chrome-internal-review.googlesource.com',
    'chromium-review.googlesource.com',
    'fuchsia-review.googlesource.com',
    'skia-review.googlesource.com',
    'turquoise-internal-review.googlesource.com',
    'webrtc-review.googlesource.com',
  ];
  let onConfirmRevert;
  let onRevert;
  let onPostRevert;
  if (rubberStamperHosts.includes(window.location.host)) {
    onConfirmRevert = installASCheckbox;
    onRevert = interceptRevertMessage;
    onPostRevert = approveAndSubmitRevert;
  } else {
    onConfirmRevert = installCQCheckbox;
    onRevert = cqInterceptRevertMessage;
    onPostRevert = cqApproveAndSubmitRevert;
  }
  plugin.hook('confirm-revert-change').onAttached(onConfirmRevert);
  plugin.on(EventType.REVERT, onRevert);
  plugin.on(EventType.POST_REVERT, onPostRevert);

  plugin.on(EventType.SHOW_CHANGE, async (change: ChangeInfo) => {
    installLgtmWatcher(replyApi);
    await installAutoSubmit(plugin, change);
    installSelfReviewWarner(plugin, change);
    await maybeInstallReland(plugin, change);
    await hideMoveChange(plugin);
  });
  plugin.on(EventType.COMMIT_MSG_EDIT, warnAboutTbr);

  // Watch for any label value changes
  installLabelValuesCallbackAutosubmit(plugin);
  installLabelValuesCallbackReviewWarner(plugin);
});
