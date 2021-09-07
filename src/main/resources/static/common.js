// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Common constants and helper functions used by multiple behaviors below.
export const REVIEW_LABEL = 'Code-Review';
export const AS_LABEL = 'Auto-Submit';
export const CQ_LABEL = 'Commit-Queue';
export const STATUS_SUBMITTED = 'MERGED';

/**
 * Returns whether the specified vote is permitted on the label.
 * @param {object} change gr-change-view
 * @param {string} labelName: The name of the label we want to check
 * @param {string} vote: The vote we will check (e.g. '+2')
 * @returns {boolean}
 */
export function isLabelVotePermitted(change, labelName, vote) {
  const permitted = change.permitted_labels[labelName] || [];
  return permitted.indexOf(vote) !== -1;
}

/**
 * Returns the max value of the specified label. Returns 0 if the label
 * cannot be found or if it has no values.
 * @param {object} change gr-change-view
 * @param {string} labelName: The name of the label we want to check
 * @returns {boolean}
 */
export function getLabelMaxValue(change, labelName) {
  if (!change.labels[labelName] || !change.labels[labelName].values) {
    return 0;
  }
  return Math.max(...Object.keys(change.labels[labelName].values));
}

/**
 * Parses git trailers (and Rietveld tags) from a commit description.
 * @param {string} message: the commit message to parse
 * @param {string} token: the LHS of the trailer to parse (e.g. 'Bug')
 * @returns {string} all found trailers in normalized form (e.g. 'Bug: 1')
 */
export function getTrailer(message, token) {
  // TODO(http://crbug.com/753425): Remove support for CAPS= style tags.
  const caps = token.replace(/-/g, '_').toUpperCase();
  const trailerRegexp = new RegExp(
      `^[ \t]*((${token}:|${caps}=)[ \t]*(.*))$`, 'gm');
  const collection = new Set();
  const collect = function(_match, _wholeGroup, _keyGroup, valueGroup) {
    collection.add(valueGroup);
  };
  message.replace(trailerRegexp, collect);
  return Array.from(collection).map((entry) => `${token}: ${entry}\n`).join('');
}

/**
 * Returns the specified label from the change if it exists else [] is
 * returned.
 * @param {object} change gr-change-view
 * @param {string} labelName: The name of the label we want
 * @returns {object} gr-change-view.label
 */
export function getChangeLabel(change, labelName) {
  return change.labels[labelName] || [];
}

/**
 * Calls the server to get an updated change obj and returns its promise.
 */
export function getChangeObj(plugin, change) {
  return plugin.restApi().get(`/changes/${change._number}/detail`);
}

/**
 * Calls the server to get list of of all draft comments that below to the
 * calling user.
 */
export function getChangeDrafts(plugin, change) {
  return plugin.restApi().get(`/changes/${change._number}/drafts`);
}

/**
 * Add email-style quoting (> ) in front of the original commit message.
 */
export function quoteOriginalMessage(revertMsg, originalMsg) {
  // Show reverts-of-reverts as relands instead.
  let newMessage = revertMsg.replace(
      /^Revert "Revert "(.*)""/, 'Reland "$1"');

  newMessage += '\nOriginal change\'s description:\n';

  // Add email-style quoting ('> ') in front of the original commit text. Empty
  // lines might end up with '> ' so change them into '>'.
  newMessage += originalMsg.trim().replace(/^/gm, '> ').replace(/^> $/gm, '>');

  return newMessage;
}
