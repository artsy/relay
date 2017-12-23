/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @emails oncallrelay
 */

'use strict';

const {
  getIDFieldDefinition,
  getNodeIDFieldDefinition,
} = require('GraphQLSchemaUtils');

const {buildSchema} = require('graphql');

describe('GraphQLSchemaUtils', () => {
  describe('getNodeIDFieldDefinition()', () => {
    it('returns the ID! field entry of the Node interface', () => {
      const schema = buildSchema(`
        interface Node {
          customNodeID: ID!
        }
      `);
      expect(getNodeIDFieldDefinition(schema).name).toEqual('customNodeID');
    });

    it('returns nothing in case no Node interface exists', () => {
      const schema = buildSchema(`
        interface NotNode {
          id: ID!
        }
      `);
      expect(getNodeIDFieldDefinition(schema)).toEqual(null);
    });

    it('throws in case the Node interface has no field of type ID!', () => {
      const schema = buildSchema(`
        interface Node {
          id: String
        }
      `);
      expect(() => getNodeIDFieldDefinition(schema)).toThrow();
    });

    it('asserts that the Node interface does not have multiple fields of type ID!', () => {
      const schema = buildSchema(`
        interface Node {
          id: ID!
          customNodeID: ID!
        }
      `);
      expect(() => getNodeIDFieldDefinition(schema)).toThrow();
    });
  });

  describe('getIDFieldDefinition()', () => {
    it('always returns the inflected Node ID! field', () => {
      const schema = buildSchema(`
        interface Node {
          customNodeID: ID!
        }
        type Artwork implements Node {
          customNodeID: ID!
        }
        type Artist {
          customNodeID: ID!
        }
      `);
      expect(
        getIDFieldDefinition(schema, schema.getType('Artwork')).name,
      ).toEqual('customNodeID');
      expect(
        getIDFieldDefinition(schema, schema.getType('Artist')).name,
      ).toEqual('customNodeID');
    });

    it('returns that a type has the fallback `id` field if the type does not implement the Node interface', () => {
      const schema = buildSchema(`
        interface Node {
          customNodeID: ID!
        }
        type Artist {
          id: ID!
        }
      `);
      expect(
        getIDFieldDefinition(schema, schema.getType('Artist')).name,
      ).toEqual('id');
    });
  });
});
