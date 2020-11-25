// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export const relandPopupTemplate = Polymer.html`
<gr-dialog
    id="relandDialog"
    confirm-label="Notify Reviewers"
    cancel-label="Reland Without Notifying"
    on-cancel="_handleCancel"
    on-confirm="_handleConfirm">
  <div class="main" slot="main">
    Click "Notify Reviewers" if you would like to send this<br/>
    reland to reviewers, or "Reland Without Notifying" if not.<br/>
  </div>
</gr-dialog>
`;
