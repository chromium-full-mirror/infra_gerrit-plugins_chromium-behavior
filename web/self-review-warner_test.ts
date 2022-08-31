/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {REVIEW_LABEL} from './common';

import {installOnSelfApproval} from './self-review-warner';

suite('self-review-warner test', () => {
  test('installOnSelfApproval without votes', () => {
    const stub = sinon.stub();
    const plugin = {
      hook: () => {
        return {
          onAttached: stub,
        };
      },
    };
    const change = {
      owner: {email: 'foo@bar.com'},
      labels: {[REVIEW_LABEL]: {}},
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    installOnSelfApproval(plugin as any, change as any);
  });

  test('installOnSelfApproval with a service account', () => {
    const stub = sinon.stub();
    const plugin = {
      hook: () => {
        return {
          onAttached: stub,
        };
      },
    };
    let change = {
      owner: {email: 'foo@bar.com'},
      labels: {
        [REVIEW_LABEL]: {
          all: [
            {
              email: 'foo@bar.com',
              value: 0,
              tags: ['SERVICE_USER'],
            },
          ],
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    installOnSelfApproval(plugin as any, change as any);
    sinon.assert.notCalled(stub);

    change = {
      owner: {email: 'foo@bar.com'},
      labels: {
        [REVIEW_LABEL]: {
          all: [
            {
              email: 'foo@bar.com',
              value: 0,
              tags: [],
            },
          ],
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    installOnSelfApproval(plugin as any, change as any);
    sinon.assert.calledOnce(stub);
  });
});
