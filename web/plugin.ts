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
import {warnerHook} from './self-review-warner';
import {getGerritHost} from './common';
import {
  installIconPreview,
  isIconPreviewHost,
} from './icon-preview/icon-preview';

window.Gerrit?.install((plugin: PluginApi) => {
  const replyApi = plugin.changeReply();
  plugin.hook('banner').onAttached((el: HTMLElement) => {
    try {
      new ChopsBanner(window.location.host, el);
    } catch (e) {
      console.warn(e);
    }
  });

  const rubberStamperHosts = [
    'chromium',
    'chrome-internal',
    'dart',
    'dart-internal',
    'fuchsia',
    'skia',
    'turquoise',
    'webrtc',
  ];
  let onConfirmRevert;
  let onRevert;
  let onPostRevert;
  const gerritHost = getGerritHost(window.location.host);
  if (rubberStamperHosts.includes(gerritHost)) {
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
  plugin.hook('change-metadata-item').onAttached(warnerHook);

  // Rendered preview toggle for Chromium vector icon (*.icon) diffs.
  if (isIconPreviewHost(gerritHost)) {
    installIconPreview(plugin);
  }

  plugin.on(EventType.SHOW_CHANGE, async (change: ChangeInfo) => {
    installLgtmWatcher(replyApi);
    await installAutoSubmit(plugin, change);
    await maybeInstallReland(plugin, change);
    await hideMoveChange(plugin);
  });
  plugin.on(EventType.COMMIT_MSG_EDIT, warnAboutTbr);

  // Watch for any label value changes
  installLabelValuesCallbackAutosubmit(plugin);
});
