/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule RelayNetworkDebug
 * 
 */

'use strict';

var _classCallCheck3 = _interopRequireDefault(require('babel-runtime/helpers/classCallCheck'));

var _promise2 = _interopRequireDefault(require('fbjs/lib/Promise'));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var RelayNetworkDebugger = function () {
  function RelayNetworkDebugger(environment) {
    var _this = this;

    (0, _classCallCheck3['default'])(this, RelayNetworkDebugger);

    this._initTime = require('fbjs/lib/performanceNow')();
    this._queryID = 0;
    this._subscription = environment.addNetworkSubscriber(function (request) {
      return _this.logRequest(createDebuggableFromRequest('Relay Query', request));
    }, function (request) {
      return _this.logRequest(createDebuggableFromRequest('Relay Mutation', request));
    });
  }

  RelayNetworkDebugger.prototype.uninstall = function uninstall() {
    this._subscription.remove();
  };

  RelayNetworkDebugger.prototype.logRequest = function logRequest(_ref) {
    var _this2 = this;

    var name = _ref.name;
    var type = _ref.type;
    var promise = _ref.promise;
    var logResult = _ref.logResult;

    var id = this._queryID++;
    var timerName = '[' + id + '] Request Duration';

    /* eslint-disable no-console */
    console.timeStamp && console.timeStamp('START: [' + id + '] ' + type + ': ' + name + ' →');
    console.time && console.time(timerName);

    var onSettled = function onSettled(error, response) {
      var time = (require('fbjs/lib/performanceNow')() - _this2._initTime) / 1000;
      console.timeStamp && console.timeStamp('← END: [' + id + '] ' + type + ': ' + name);
      var groupName = '%c[' + id + '] ' + type + ': ' + name + ' @ ' + time + 's';
      console.groupCollapsed ? console.groupCollapsed(groupName, 'color:' + (error ? 'red' : 'black') + ';') : console.log(groupName);
      console.timeEnd && console.timeEnd(timerName);
      logResult(error, response);
      console.groupEnd && console.groupEnd();
    };
    /* eslint-enable no-console */

    promise.then(function (response) {
      return onSettled(null, response);
    }, function (error) {
      return onSettled(error, null);
    });
  };

  return RelayNetworkDebugger;
}();

function createDebuggableFromRequest(type, request) {
  return {
    name: request.getDebugName(),
    type: type,
    promise: request.getPromise(),
    logResult: function logResult(error, response) {
      /* eslint-disable no-console */
      console.debug && console.debug('%c%s\n', 'font-size:10px; color:#333; font-family:mplus-2m-regular,menlo,' + 'monospaced;', request.getQueryString());
      console.log('Request variables\n', request.getVariables());
      error && console.error(error);
      response && console.log(response);
      /* eslint-enable no-console */
    }
  };
}

var networkDebugger = void 0;

var RelayNetworkDebug = {
  init: function init() {
    var environment = arguments.length <= 0 || arguments[0] === undefined ? require('./RelayPublic').Store : arguments[0];

    networkDebugger && networkDebugger.uninstall();
    if (console.groupCollapsed) {
      // without groupCollapsed RelayNetworkDebug is too noisy
      networkDebugger = new RelayNetworkDebugger(environment);
    }
  },
  logRequest: function logRequest(request) {
    networkDebugger && networkDebugger.logRequest(request);
  }
};

module.exports = RelayNetworkDebug;