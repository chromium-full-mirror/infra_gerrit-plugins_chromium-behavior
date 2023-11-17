/**
 * @license
 * Copyright 2022 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {
  ApprovalInfo,
  ChangeInfo,
  DetailedLabelInfo,
  LabelInfo,
  isDetailedLabelInfo,
  isQuickLabelInfo,
} from '@gerritcodereview/typescript-api/rest-api';

import {PluginApi} from '@gerritcodereview/typescript-api/plugin';

// Common constants and helper functions used by multiple behaviors below.
export const REVIEW_LABEL = 'Code-Review';
export const AS_LABEL = 'Auto-Submit';
export const CQ_LABEL = 'Commit-Queue';
export const STATUS_SUBMITTED = 'MERGED';

/**
 * Returns the name of the Gerrit host.
 *
 * @param host - a URL
 * @returns Gerrit host
 */
export function getGerritHost(host: string): string {
  const match =
    /^(?:canary-)?(.+)-review\.(?:googlesource|git\.corp\.google)\.com/.exec(
      host
    );
  return (match && match[1]) ?? '';
}

/**
 * Returns whether the specified vote is permitted on the label.
 *
 * @param change - gr-change-view
 * @param labelName - The name of the label we want to check
 * @param vote - The vote we will check (e.g. '+2')
 * @returns
 */
export function isLabelVotePermitted(
  change: ChangeInfo,
  labelName: string,
  vote: string
) {
  const permitted_labels = change.permitted_labels;
  if (!permitted_labels) {
    return false;
  }
  const permitted = permitted_labels[labelName];
  return permitted && permitted.indexOf(vote) !== -1;
}

/**
 * Returns the max value of the specified label. Returns 0 if the label
 * cannot be found or if it has no values.
 *
 * @param change - gr-change-view
 * @param labelName - The name of the label we want to check
 * @returns
 */
export function getLabelMaxValue(change: ChangeInfo, labelName: string) {
  const label = getChangeLabel(change, labelName);
  if (!label || !isDetailedLabelInfo(label) || !label.values) {
    return 0;
  }
  const votes = Object.keys(label.values).map((v: string) =>
    // convert string to int
    Number(v)
  );
  return Math.max(...votes);
}

/**
 * Parses git trailers (and Rietveld tags) from a commit description.
 *
 * @param message - the commit message to parse
 * @param token - the LHS of the trailer to parse (e.g. 'Bug')
 * @returns all found trailers in normalized form (e.g. 'Bug: 1')
 */
export function getTrailer(message: string, token: string,
                           normalize: boolean = true): string {
  // TODO(http://crbug.com/753425): Remove support for CAPS= style tags /
  // normalize = False. Until this style is officially unsupported, maintain
  // style (see b/274781829).
  const caps = token.replace(/-/g, '_').toUpperCase();
  const trailerRegexp = new RegExp(
    `^[ \t]*(${token}|${caps})(:|=)[ \t]*(.*)$`,
    'gm'
  );
  const response = new Set();
  for (const match of message.matchAll(trailerRegexp)) {
    const sep = match[2];
    if (sep === ':' || normalize) {
      response.add(`${token}: ${match[3]}\n`);
    } else {
      response.add(`${caps}=${match[3]}\n`);
    }
  }
  return Array.from(response).join('');
}

/**
 * Returns the specified label from the change if it exists else {} is
 * returned.
 *
 * @param change - gr-change-view
 * @param labelName - The name of the label we want
 */
export function getChangeLabel(
  change: ChangeInfo,
  labelName: string
): LabelInfo | null {
  if (change.labels) {
    return change.labels[labelName];
  }
  return {};
}

export function getApprovalsForLabel(
  change: ChangeInfo,
  labelName: string
): ApprovalInfo[] {
  const label = getChangeLabel(change, labelName);
  if (!label) {
    return [];
  }
  return (label as DetailedLabelInfo).all || [];
}

export function isLabelApproved(change: ChangeInfo, labelName: string) {
  const label = getChangeLabel(change, labelName);
  return label && isQuickLabelInfo(label) ? label.approved : false;
}

/**
 * Calls the server to get an updated change obj and returns its promise.
 */
export function getChangeObj(
  plugin: PluginApi,
  change: ChangeInfo
): Promise<ChangeInfo> {
  return plugin.restApi().get(`/changes/${change._number}/detail`);
}

/**
 * Calls the server to get list of of all draft comments that below to the
 * calling user.
 */
export function getChangeDrafts(plugin: PluginApi, change: ChangeInfo) {
  return plugin.restApi().get(`/changes/${change._number}/drafts`);
}

/**
 * Add email-style quoting (> ) in front of the original commit message.
 */
export function quoteOriginalMessage(revertMsg: string, originalMsg: string) {
  // Show reverts-of-reverts as relands instead.
  let newMessage = revertMsg.replace(/^Revert "Revert "(.*)""/, 'Reland "$1"');

  newMessage += "\nOriginal change's description:\n";

  // Add email-style quoting ('> ') in front of the original commit text. Empty
  // lines might end up with '> ' so change them into '>'.
  newMessage += originalMsg.trim().replace(/^/gm, '> ').replace(/^> $/gm, '>');

  return newMessage;
}
