// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {ChopsBanner} from './chops-banner.js';
import {approveAndSubmitRevert, installCQCheckbox,
  interceptRevertMessage} from './revert-munger.js';
import {installLgtmWatcher} from './lgtm-catcher.js';
import {installAutoSubmit} from './autosubmit.js';
import {maybeInstallReland} from './reland-button.js';
import {warnAboutTbr} from './tbr-warner.js';

Gerrit.install((plugin) => {
  const chopsBanner = new ChopsBanner(window.location.host);
  plugin.hook('banner').onAttached((el) => {
    chopsBanner.register(el);
  });
  plugin.hook('confirm-revert-change').onAttached((el) => {
    installCQCheckbox(el);
  });
  plugin.on('revert', interceptRevertMessage);
  plugin.on('postrevert', approveAndSubmitRevert);

  plugin.on('showchange', (change) => {
    installLgtmWatcher(plugin.changeReply());
  });
  plugin.on('showchange', (change) => {
    installAutoSubmit(plugin, change);
  });
  plugin.on('showchange', (change) => {
    maybeInstallReland(plugin, change);
  });
  plugin.on('commitmsgedit', warnAboutTbr);
});
