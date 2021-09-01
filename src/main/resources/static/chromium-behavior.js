// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {ChopsBanner} from './chops-banner.js';
import {approveAndSubmitRevert, installASCheckbox,
  interceptRevertMessage} from './revert-munger.js';
import {cqApproveAndSubmitRevert, installCQCheckbox,
  cqInterceptRevertMessage} from './cq-revert-munger.js';
import {hideMoveChange} from './hide-move-change.js';
import {installAutoSubmit} from './autosubmit.js';
import {installLgtmWatcher} from './lgtm-catcher.js';
import {maybeInstallReland} from './reland-button.js';
import {warnAboutTbr} from './tbr-warner.js';
import {installSelfReviewWarner} from './self-review-warner.js';

Gerrit.install((plugin) => {
  const chopsBanner = new ChopsBanner(window.location.host);
  plugin.hook('banner').onAttached((el) => {
    chopsBanner.register(el);
  });

  const rubberStamperHosts = ['chromium', 'chrome-internal', 'skia'];
  plugin.getServerInfo().then((config) => {
    let onConfirmRevert, onRevert, onPostRevert;
    if (rubberStamperHosts.includes(config.gerrit.instance_id)) {
      onConfirmRevert = installASCheckbox;
      onRevert = interceptRevertMessage;
      onPostRevert = approveAndSubmitRevert;
    } else {
      onConfirmRevert = installCQCheckbox;
      onRevert = cqInterceptRevertMessage;
      onPostRevert = cqApproveAndSubmitRevert;
    }
    plugin.hook('confirm-revert-change').onAttached(onConfirmRevert);
    plugin.on('revert', onRevert);
    plugin.on('postrevert', onPostRevert);
  });

  plugin.on('showchange', (change) => {
    installLgtmWatcher(plugin.changeReply());
    installAutoSubmit(plugin, change);
    installSelfReviewWarner(plugin, change);
    maybeInstallReland(plugin, change);
    hideMoveChange(plugin, change);
  });
  plugin.on('commitmsgedit', warnAboutTbr);
});
