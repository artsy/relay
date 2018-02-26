/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @emails oncall+relay
 */

'use strict';

const GraphQLCompilerContext = require('GraphQLCompilerContext');
const RelayFlowGenerator = require('RelayFlowGenerator');
const RelayRelayDirectiveTransform = require('RelayRelayDirectiveTransform');
const RelayTestSchema = require('RelayTestSchema');

const parseGraphQLText = require('parseGraphQLText');

const {transformASTSchema} = require('ASTConvert');
const {generateTestsFromFixtures} = require('RelayModernTestUtils');

import type {TypeGeneratorOptions} from '../../RelayLanguagePluginInterface';

function generate(text, options: TypeGeneratorOptions) {
  const schema = transformASTSchema(RelayTestSchema, [
    RelayRelayDirectiveTransform.SCHEMA_EXTENSION,
  ]);
  const {definitions} = parseGraphQLText(schema, text);
  return new GraphQLCompilerContext(RelayTestSchema, schema)
    .addAll(definitions)
    .applyTransforms(RelayFlowGenerator.transforms)
    .documents()
    .map(doc => RelayFlowGenerator.generate(doc, options))
    .join('\n\n');
}

describe('RelayFlowGenerator', () => {
  generateTestsFromFixtures(`${__dirname}/fixtures/flow-generator`, text =>
    generate(text, {
      customScalars: {},
      enumsHasteModule: null,
      existingFragmentNames: new Set(['PhotoFragment']),
      inputFieldWhiteList: [],
      relayRuntimeModule: 'relay-runtime',
      useHaste: true,
      useSingleArtifactDirectory: false,
    }),
  );

  it('imports fragment refs from siblings in a single artifact dir', () => {
    const text = `
      fragment Picture on Image {
        ...PhotoFragment
      }
    `;
    const types = generate(text, {
      customScalars: {},
      enumsHasteModule: null,
      existingFragmentNames: new Set(['PhotoFragment']),
      inputFieldWhiteList: [],
      relayRuntimeModule: 'relay-runtime',
      // This is what's different from the tests above.
      useHaste: false,
      useSingleArtifactDirectory: true,
    });
    expect(types).toContain(
      "import type { PhotoFragment$ref } from './PhotoFragment.graphql';",
    );
  });
});
