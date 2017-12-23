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
const GraphQLIRPrinter = require('GraphQLIRPrinter');
const RelayGenerateIDFieldTransform = require('RelayGenerateIDFieldTransform');
const RelayParser = require('RelayParser');
const RelayTestSchema = require('RelayTestSchema');

const {generateTestsFromFixtures} = require('RelayModernTestUtils');

function transformAST(ast) {
  return new GraphQLCompilerContext(RelayTestSchema)
    .addAll(ast)
    .applyTransforms([RelayGenerateIDFieldTransform.transform])
    .documents();
}

function transformDocuments(text) {
  return transformAST(RelayParser.parse(RelayTestSchema, text));
}

function printTransformedDocuments(text) {
  return transformDocuments(text)
    .map(GraphQLIRPrinter.print)
    .join('\n');
}

describe('RelayGenerateIDFieldTransform', () => {
  generateTestsFromFixtures(
    `${__dirname}/fixtures/generate-id-field-transform`,
    printTransformedDocuments,
  );

  it('records the fact that an existing ID selection is to be used at runtime', () => {
    const transformed = transformDocuments(
      `
      query StoryQuery {
        story {
          lastName
          id
        }
      }
    `,
    );
    const idField = transformed[0].selections[0].selections[1];
    expect(idField.metadata).toEqual({isDataID: true});
  });

  it('records the fact that an existing ID selection is to be used at runtime and retains existing metadata', () => {
    const ast = RelayParser.parse(
      RelayTestSchema,
      `
      query StoryQuery {
        story {
          lastName
          id
        }
      }
    `,
    );
    ast[0].selections[0].selections[1].metadata = {someOtherMetadata: true};
    const transformed = transformAST(ast);
    const idField = transformed[0].selections[0].selections[1];
    expect(idField.metadata).toEqual({
      isDataID: true,
      someOtherMetadata: true,
    });
  });

  it('records the fact that a new ID selection is to be used at runtime', () => {
    const transformed = transformDocuments(
      `
      query StoryQuery {
        story {
          lastName
        }
      }
    `,
    );
    const idField = transformed[0].selections[0].selections[1];
    expect(idField.metadata).toEqual({isDataID: true});
  });
});
