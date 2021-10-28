/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {PluginApi} from '@gerritcodereview/typescript-api/plugin';

import {
  ActionType,
  ChangeActions,
} from '@gerritcodereview/typescript-api/change-actions';

/**
 * Removes Move change from UI, regardless of Gerrit configuration.
 */
export async function hideMoveChange(plugin: PluginApi) {
  const changeActions = plugin.changeActions();
  changeActions.setActionHidden(ActionType.CHANGE, ChangeActions.MOVE, true);
}
