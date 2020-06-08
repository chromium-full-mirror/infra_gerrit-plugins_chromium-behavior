// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export const autosubmitPopupTemplate = Polymer.html`
<gr-dialog
    id="autosubmitDialog"
    confirm-label="Trigger Autosubmit"
    cancel-label="Approve without Autosubmit"
    on-cancel="_handleCancel"
    on-confirm="_handleConfirm">
  <div class="header" slot="header">
    This change's owner has enabled Auto-Submit
  </div>
  <div class="main" slot="main">
    Click "Trigger Autosubmit" if you would like to send this<br/>
    change to the CQ, or "Approve without Autosubmit" if not.<br/>
    <template is="dom-if" if="[[!_isApprovedByAllOtherReviewers()]]">
      <br/>
      <b>Note:</b> Not all reviewers have approved this change!
    </template>
    <template is="dom-if" if="[[unresolvedCommentsOrDrafts]]">
      <br/>
      <b>Note:</b> This change has unresolved comments and/or drafts!
    </template>
  </div>
</gr-dialog>
`;
