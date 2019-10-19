#
# Copyright (c) 2017, Joyent, Inc.
#

#
# Makefile.defs defines variables used as part of the build process.
#
include ./tools/mk/Makefile.defs

NPM =			npm
JSSTYLE =		jsstyle
JSLINT =		jsl

#
# Configuration used by Makefile.defs and Makefile.targ to generate
# "check" and "docs" targets.
#
JSON_FILES =		package.json
JS_FILES :=		$(shell find examples lib tests -name '*.js')
JSL_FILES_NODE =	$(JS_FILES)
JSSTYLE_FILES =		$(JS_FILES)

JSL_CONF_NODE =		tools/jsl.node.conf

#
# Makefile.node_modules.defs provides a common target for installing modules
# with NPM from a dependency specification in a "package.json" file.  By
# including this Makefile, we can depend on $(STAMP_NODE_MODULES) to drive "npm
# install" correctly.
#
include ./tools/mk/Makefile.node_modules.defs

.PHONY: all
all: $(STAMP_NODE_MODULES)

.PHONY: test
test: all
	@node tests/tst.basic.js
	@node tests/tst.bucketize_linear.js
	@node tests/tst.bucketize_loglinear.js
	@node tests/tst.bucketize_p2.js
	@node tests/tst.nonnumeric.js
	@echo all tests passed

#
# Target definitions.  This is where we include the target Makefiles for
# the "defs" Makefiles we included above.
#

include ./tools/mk/Makefile.targ
include ./tools/mk/Makefile.node_modules.targ
