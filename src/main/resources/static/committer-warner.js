// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {STATUS_SUBMITTED} from './common.js';

const COMMITTER_WARNER_STYLES = {
  styleContainer:
      'display: inline-block;' +
      'width: 100%;' +
      'padding-top: var(--spacing-l);' +
      'padding-left: var(--metadata-horizontal-padding);' +
      'padding-bottom: var(--spacing-l);',
};

/**
 * Adds a committer warning to the page if appropriate.
 * @param {element} element: the change-metadata-item element.
 */
export async function maybeInstallCommitterWarning(element) {
  if (element.change.status === STATUS_SUBMITTED) {
    return;
  }

  if (element.revision.commit.author.email ===
      element.revision.commit.committer.email) {
    return;
  }

  const message = "Author and Committer are different";
  installCommitterWarning(element, message);
}

/**
 * Adds a committer warning to the page.
 * @param {element} element: the element object
 * @param {string} message: the message for the current change
 */
function installCommitterWarning(element, message) {
  element.innerHTML = `
  <div style="${COMMITTER_WARNER_STYLES.styleContainer}">
    <span><span style='color:red; font-weight: bold'>⚠</span> ${message}</span>
  </div>
  `;
}
