/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @format
 * @emails oncall+relay
 */

'use strict';

const RelayCompilerContext = require('RelayCompilerContext');
const RelayGenerateRequisiteFieldsTransform = require('RelayGenerateRequisiteFieldsTransform');
const RelayParser = require('RelayParser');
const RelayPrinter = require('RelayPrinter');
const RelayTestSchema = require('RelayTestSchema');

const getGoldenMatchers = require('getGoldenMatchers');
const { buildSchema } = require('graphql');

describe('RelayGenerateRequisiteFieldsTransform', () => {
  beforeEach(() => {
    expect.extend(getGoldenMatchers(__filename));
  });

  it('matches expected output', () => {
    expect(
      'fixtures/generate-requisite-fields-transform',
    ).toMatchGolden(text => {
      const ast = RelayParser.parse(RelayTestSchema, text);
      const context = ast.reduce(
        (ctx, node) => ctx.add(node),
        new RelayCompilerContext(RelayTestSchema),
      );
      const nextContext = RelayGenerateRequisiteFieldsTransform.transform(
        context,
      );
      const documents = [];
      nextContext.documents().map(doc => {
        documents.push(RelayPrinter.print(doc));
      });
      return documents.join('\n');
    });
  });

  describe('concerning a custom Node ID field', () => {
    const schema = buildSchema(`
      schema {
        query: Query
      }

      type Query {
        node(__id: ID!): Node
        artist(slug: String!): Artist
        artwork(slug: String!): Artwork
      }

      interface Node {
        __id: ID!
      }

      type Painting {
        __id: ID!
        width: Float!
        height: Float!
      }

      type Statue {
        __id: ID!
        width: Float!
        height: Float!
        depth: Float!
      }

      union Artwork = Painting | Statue

      type Artist implements Node {
        __id: ID!
        name: String!
        artworks: [Artwork]
      }
    `);

    it('inflects the ID field name from the schema and tests if an unaliased selection for it exists', () => {
      const ast = RelayParser.parse(schema, `
        query ArtistQuery {
          artist(slug: "banksy") {
            __id
          }
        }
      `);
      const context = ast.reduce(
        (ctx, node) => ctx.add(node),
        new RelayCompilerContext(schema)
      );
      const nextContext = RelayGenerateRequisiteFieldsTransform.transform(context);
      const documents = [];
      nextContext.documents().map(doc => {
        documents.push(RelayPrinter.print(doc));
      });
      expect(documents.join('\n').trim()).toEqual(`
        query ArtistQuery {
          artist(slug: "banksy") {
            __id
          }
        }
      `.replace(/^\s{8}/gm, '').trim());
    });

    it('inflects the ID field name from the schema for concrete types', () => {
      const ast = RelayParser.parse(schema, `
        query ArtistQuery {
          artist(slug: "banksy") {
            name
          }
        }
      `);
      const context = ast.reduce(
        (ctx, node) => ctx.add(node),
        new RelayCompilerContext(schema)
      );
      const nextContext = RelayGenerateRequisiteFieldsTransform.transform(context);
      const documents = [];
      nextContext.documents().map(doc => {
        documents.push(RelayPrinter.print(doc));
      });
      expect(documents.join('\n').trim()).toEqual(`
        query ArtistQuery {
          artist(slug: "banksy") {
            name
            __id
          }
        }
      `.replace(/^\s{8}/gm, '').trim());
    });

    it('inflects the ID field name from the schema for the `node` field', () => {
      const ast = RelayParser.parse(schema, `
        query NodeFieldQuery {
          node(__id: "Artist:banksy") {
            __typename
          }
        }
      `);
      const context = ast.reduce(
        (ctx, node) => ctx.add(node),
        new RelayCompilerContext(schema)
      );
      const nextContext = RelayGenerateRequisiteFieldsTransform.transform(context);
      const documents = [];
      nextContext.documents().map(doc => {
        documents.push(RelayPrinter.print(doc));
      });
      expect(documents.join('\n').trim()).toEqual(`
        query NodeFieldQuery {
          node(__id: "Artist:banksy") {
            __typename
            __id
          }
        }
      `.replace(/^\s{8}/gm, '').trim());
    });

    it('inflects the ID field name from the schema for union types', () => {
      const ast = RelayParser.parse(schema, `
        query ArtworkQuery {
          artwork(slug: "mona-lisa") {
            ... on Painting {
              width
              height
            }
          }
        }
      `);
      const context = ast.reduce(
        (ctx, node) => ctx.add(node),
        new RelayCompilerContext(schema)
      );
      const nextContext = RelayGenerateRequisiteFieldsTransform.transform(context);
      const documents = [];
      nextContext.documents().map(doc => {
        documents.push(RelayPrinter.print(doc));
      });
      expect(documents.join('\n').trim()).toEqual(`
        query ArtworkQuery {
          artwork(slug: "mona-lisa") {
            __typename
            ... on Painting {
              width
              height
            }
            ... on Painting {
              __id
            }
            ... on Statue {
              __id
            }
          }
        }
      `.replace(/^\s{8}/gm, '').trim());
    });
  });
});
