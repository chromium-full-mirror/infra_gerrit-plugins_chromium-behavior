// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Common constants and helper functions used by multiple behaviors below.
let PLUGIN = null;
export const REVIEW_LABEL = 'Code-Review';
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
  var caps = token.replace(/-/g, '_').toUpperCase();
  var trailerRegexp = new RegExp(
    `^[ \t]*((${token}:|${caps}=)[ \t]*(.*))$`, 'gm');
  var collection = new Set();
  var collect = function(match, _wholeGroup, _keyGroup, valueGroup) {
    valueGroup.split(/\s*,+\s*/).forEach(function (value) {
      if (value) {
        collection.add(value);
      }
    });
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
export function getChangeObj(plugin) {
  const changeNum = plugin.changeActions()._el.changeNum;
  var  url = '/changes/' + changeNum + '/detail';
  return plugin.restApi().get(url);
}

/**
 * Calls the server to get list of of all draft comments that below to the
 * calling user.
 */
export function getChangeDrafts(plugin) {
  const changeNum = plugin.changeActions()._el.changeNum;
  var  url = '/changes/' + changeNum + '/drafts';
  return plugin.restApi().get(url);
}
