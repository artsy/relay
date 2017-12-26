/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @providesModule RelayGenerateIDFieldTransform
 * @format
 */

'use strict';

const {hasUnaliasedSelection} = require('./RelayTransformUtils');
const {assertAbstractType, assertCompositeType} = require('graphql');
const {
  CompilerContext,
  SchemaUtils,
  IRTransformer,
} = require('graphql-compiler');

import type {
  Fragment,
  InlineFragment,
  LinkedField,
  ScalarField,
} from 'graphql-compiler';
import type {GraphQLCompositeType, GraphQLField} from 'graphql';

const {
  NODE_TYPE,
  canHaveSelections,
  getIDFieldDefinition,
  getNodeIDFieldDefinition,
  getRawType,
  implementsInterface,
  isAbstractType,
  mayImplement,
} = SchemaUtils;

/**
 * A transform that adds an `id` field on any type that has an id field but
 * where there is no unaliased `id` selection.
 */
function relayGenerateIDFieldTransform(
  context: CompilerContext,
): CompilerContext {
  return IRTransformer.transform(context, {
    LinkedField: visitNodeWithSelections,
    Fragment: visitNodeWithSelections,
  });
}

function visitNodeWithSelections<T: Fragment | LinkedField>(node: T): T {
  const transformedNode = this.traverse(node);
  const context = this.getContext();
  const schema = context.serverSchema;
  const unmodifiedType = assertCompositeType(getRawType(node.type));
  const idFieldDefinition = getIDFieldDefinition(schema, unmodifiedType);

  if (idFieldDefinition) {
    // If the field already has an unaliased `id` field, do nothing
    if (hasUnaliasedSelection(node, idFieldDefinition.name)) {
      return transformedNode;
    }
    // If the field type has a ID field add a selection for that field
    if (canHaveSelections(unmodifiedType)) {
      return {
        ...transformedNode,
        selections: [
          ...transformedNode.selections,
          buildSelectionFromFieldDefinition(idFieldDefinition),
        ],
      };
    }
  }

  // - If the field type is abstract, then generate a `... on Node { id }`
  //   fragment if *any* concrete type implements Node. Then generate a
  //   `... on PossibleType { id }` for every concrete type that does *not*
  //   implement `Node`
  // - If the field type implements the Node interface, return a selection of the
  //   one field in the Node interface that is of type `ID!`.
  if (isAbstractType(unmodifiedType)) {
    const selections = [...transformedNode.selections];
    if (mayImplement(schema, unmodifiedType, NODE_TYPE)) {
      const nodeType = assertCompositeType(schema.getType(NODE_TYPE));
      const nodeIDFieldDefinition = getNodeIDFieldDefinition(schema);
      if (nodeIDFieldDefinition) {
        selections.push(
          buildIDFragmentFromFieldDefinition(nodeType, nodeIDFieldDefinition),
        );
      }
    }
    const abstractType = assertAbstractType(unmodifiedType);
    schema.getPossibleTypes(abstractType).forEach(possibleType => {
      if (!implementsInterface(possibleType, NODE_TYPE)) {
        const possibleTypeIDFieldDefinition = getIDFieldDefinition(
          schema,
          possibleType,
        );
        if (possibleTypeIDFieldDefinition) {
          selections.push(
            buildIDFragmentFromFieldDefinition(
              possibleType,
              possibleTypeIDFieldDefinition,
            ),
          );
        }
      }
    });
    return {
      ...transformedNode,
      selections,
    };
  }

  return transformedNode;
}

/**
 * @internal
 *
 * Returns IR for `... on FRAGMENT_TYPE { id }`
 */
function buildIDFragmentFromFieldDefinition(
  fragmentType: GraphQLCompositeType,
  idField: GraphQLField<*, *>,
): InlineFragment {
  return {
    kind: 'InlineFragment',
    directives: [],
    metadata: null,
    typeCondition: fragmentType,
    selections: [buildSelectionFromFieldDefinition(idField)],
  };
}

/**
 * @internal
 */
function buildSelectionFromFieldDefinition(
  field: GraphQLField<*, *>,
): ScalarField {
  return {
    kind: 'ScalarField',
    alias: (null: ?string),
    args: [],
    directives: [],
    handles: null,
    metadata: null,
    name: field.name,
    type: (field.type: any),
  };
}

module.exports = {
  transform: relayGenerateIDFieldTransform,
};
