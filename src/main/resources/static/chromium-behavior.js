// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {ChopsBanner} from './chops-banner.js';
import {approveAndSubmitRevert, installCQCheckbox,
  interceptRevertMessage} from './revert-munger.js';
import {hideMoveChange} from './hide-move-change.js';
import {installAutoSubmit} from './autosubmit.js';
import {installLgtmWatcher} from './lgtm-catcher.js';
import {maybeInstallReland} from './reland-button.js';
import {warnAboutTbr} from './tbr-warner.js';
import {maybeInstallCommitterWarning} from './committer-warner.js';

Gerrit.install((plugin) => {
  const chopsBanner = new ChopsBanner(window.location.host);
  plugin.hook('banner').onAttached((el) => {
    chopsBanner.register(el);
  });
  plugin.hook('confirm-revert-change').onAttached((el) => {
    installCQCheckbox(el);
  });
  plugin.hook('change-metadata-item').onAttached((el) => {
    maybeInstallCommitterWarning(el);
  });
  plugin.on('revert', interceptRevertMessage);
  plugin.on('postrevert', approveAndSubmitRevert);

  plugin.on('showchange', (change) => {
    installLgtmWatcher(plugin.changeReply());
    installAutoSubmit(plugin, change);
    maybeInstallReland(plugin, change);
    hideMoveChange(plugin, change);
  });
  plugin.on('commitmsgedit', warnAboutTbr);
});
