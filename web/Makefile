# Copyright 2022 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

.PHONY: test

test:
	bazel test --test_output=all //plugins/chromium-behavior/web:karma_test

lint_test:
	bazel test //plugins/chromium-behavior/web:lint_test

lint_fix:
	bazel run //plugins/chromium-behavior/web:lint_bin -- --fix "./"

build:
	bazel build //plugins/chromium-behavior/web:chromium-behavior && \
	cp -f ../../../bazel-bin/plugins/chromium-behavior/web/chromium-behavior.js ../
